"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { setSettings, useSettings } from "@/lib/store";
import {
  clampDiag,
  diagForDistance,
  dims,
  fmtDiag,
  fmtLen,
  IN_TO_CM,
  nearestPreset,
  viewingAngle,
} from "@/lib/tv";
import { openQuickLook, supportsQuickLook } from "@/lib/quicklook";
import { CameraAR } from "./CameraAR";
import { ScaleCompare } from "./ScaleCompare";
import { AspectPicker, SizePicker, UnitToggle } from "./SizePicker";
import { Icon } from "./Icon";

const XRView = dynamic(() => import("./XRView"), { ssr: false });

const noopSubscribe = () => () => {};

type View = { kind: "home" } | { kind: "camera" } | { kind: "xr"; calibrate: boolean };

export function App() {
  const s = useSettings();
  const [view, setView] = useState<View>({ kind: "home" });
  const [xrOk, setXrOk] = useState(false);
  const qlOk = useSyncExternalStore(noopSubscribe, supportsQuickLook, () => false);
  const [qlBusy, setQlBusy] = useState(false);

  useEffect(() => {
    navigator.xr?.isSessionSupported("immersive-ar").then(setXrOk).catch(() => {});
  }, []);

  const t = dims(s.targetDiag, s.targetAspect);
  const areaGain = Math.round(((s.targetDiag / s.refDiag) ** 2 - 1) * 100);
  const angle = viewingAngle(s.targetDiag, s.distance, s.targetAspect);
  const comfy = nearestPreset(clampDiag(diagForDistance(s.distance, 30, s.targetAspect)));
  const cine = nearestPreset(clampDiag(diagForDistance(s.distance, 40, s.targetAspect)));
  const distLabel =
    s.unit === "cm" ? `${((s.distance * IN_TO_CM) / 100).toFixed(1)} m` : `${Math.floor(s.distance / 12)}′ ${Math.round(s.distance % 12)}″`;

  const quickLook = async () => {
    setQlBusy(true);
    try {
      await openQuickLook(s.targetDiag, s.targetAspect, s.xrScale);
    } finally {
      setQlBusy(false);
    }
  };

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-16">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-accent to-accent-2 grid place-items-center shadow-lg shadow-accent/30">
              <Icon name="tv" className="size-5 text-white" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Screenfit</span>
          </div>
          <UnitToggle value={s.unit} onChange={(unit) => setSettings({ unit })} />
        </header>

        <section className="pt-4 pb-8 sm:pt-10">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] max-w-3xl">
            <span className="grad-text">See your next TV</span>
            <br />
            in your room, at real size.
          </h1>
          <p className="text-muted mt-4 max-w-xl text-lg">
            Point your camera at the TV you own today. Screenfit uses it as a ruler and draws any bigger screen to true
            scale right on top of it.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] [&>*]:min-w-0">
          {/* Size explorer */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="label">Size you&apos;re considering</div>
              <AspectPicker value={s.targetAspect} onChange={(targetAspect) => setSettings({ targetAspect })} />
            </div>
            <div className="mt-4 rounded-2xl bg-black/30 border border-line p-4">
              <ScaleCompare
                refDiag={s.refDiag}
                refAspect={s.refAspect}
                targetDiag={s.targetDiag}
                targetAspect={s.targetAspect}
                unit={s.unit}
              />
              <div className="flex gap-4 justify-center text-xs text-muted mt-2">
                <span className="flex items-center gap-1.5">
                  <i className="size-2.5 rounded-sm bg-accent inline-block" /> {fmtDiag(s.targetDiag, s.unit)} new
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="size-2.5 rounded-sm border border-dashed border-accent-2 inline-block" />
                  {fmtDiag(s.refDiag, s.unit)} current
                </span>
              </div>
            </div>
            <div className="mt-5">
              <SizePicker
                value={s.targetDiag}
                onChange={(targetDiag) => setSettings({ targetDiag })}
                unit={s.unit}
                refDiag={s.refDiag}
              />
            </div>
            <dl className="grid grid-cols-3 gap-2 mt-5">
              {[
                ["Width", fmtLen(t.w, s.unit)],
                ["Height", fmtLen(t.h, s.unit)],
                ["vs. current", `${areaGain >= 0 ? "+" : ""}${areaGain}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/[0.04] border border-line p-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-semibold text-lg tabular-nums mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex flex-col gap-4 min-w-0">
            {/* AR launchers */}
            <section className="card p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute -top-24 -right-20 size-64 rounded-full bg-accent/25 blur-3xl pointer-events-none" />
              <div className="label">View it in your room</div>
              <button
                className="mt-4 w-full text-left rounded-2xl p-4 bg-gradient-to-br from-accent/90 to-[#3a63ff] hover:brightness-110 transition active:scale-[0.99]"
                onClick={() => setView({ kind: "camera" })}
              >
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-white/15 grid place-items-center">
                    <Icon name="camera" className="size-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Camera AR</div>
                    <div className="text-sm text-white/75">Calibrate against your TV · works on any phone</div>
                  </div>
                  <Icon name="arrow-right" className="size-5" />
                </div>
              </button>

              {xrOk && (
                <button
                  className="mt-3 w-full text-left rounded-2xl p-4 bg-white/[0.06] border border-line hover:bg-white/10 transition"
                  onClick={() => setView({ kind: "xr", calibrate: false })}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-white/10 grid place-items-center">
                      <Icon name="cube" className="size-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">True-scale 3D AR</div>
                      <div className="text-sm text-muted">Place on a wall or stand, walk around it</div>
                    </div>
                    <Icon name="arrow-right" className="size-5 text-muted" />
                  </div>
                </button>
              )}

              {qlOk && (
                <button
                  className="mt-3 w-full text-left rounded-2xl p-4 bg-white/[0.06] border border-line hover:bg-white/10 transition"
                  onClick={quickLook}
                  disabled={qlBusy}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-white/10 grid place-items-center">
                      <Icon name="cube" className="size-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{qlBusy ? "Preparing…" : "View in 3D AR (iPhone)"}</div>
                      <div className="text-sm text-muted">Real-size {fmtDiag(s.targetDiag, s.unit)} on a stand</div>
                    </div>
                    <Icon name="arrow-right" className="size-5 text-muted" />
                  </div>
                </button>
              )}

              {(xrOk || qlOk) && (
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>
                    3D scale correction:{" "}
                    <b className="text-fg">
                      {s.xrScale === 1 ? "none" : `${s.xrScale > 1 ? "+" : ""}${((s.xrScale - 1) * 100).toFixed(1)}%`}
                    </b>
                  </span>
                  {xrOk && (
                    <button className="underline underline-offset-2" onClick={() => setView({ kind: "xr", calibrate: true })}>
                      Calibrate with my TV
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Reference TV */}
            <section className="card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="label">Your current TV</div>
                <AspectPicker value={s.refAspect} onChange={(refAspect) => setSettings({ refAspect })} />
              </div>
              <p className="text-sm text-muted mt-2 mb-4">This is the ruler AR uses — set it to the size you own.</p>
              <SizePicker value={s.refDiag} onChange={(refDiag) => setSettings({ refDiag })} unit={s.unit} compact />
            </section>
          </div>
        </div>

        {/* Seating distance */}
        <section className="card p-5 sm:p-6 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label">Ideal size for your sofa</div>
              <h2 className="text-2xl font-semibold mt-1">
                You sit <span className="grad-text">{distLabel}</span> from the screen
              </h2>
            </div>
            <div className="text-sm text-muted flex items-center gap-1.5">
              <Icon name="info" className="size-4" /> {fmtDiag(s.targetDiag, s.unit)} fills {angle.toFixed(0)}° of your view
            </div>
          </div>
          <input
            className="mt-4"
            type="range"
            min={36}
            max={240}
            step={1}
            value={s.distance}
            onChange={(e) => setSettings({ distance: Number(e.target.value) })}
            aria-label="Seating distance"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {[
              { name: "Comfortable", sub: "30° · SMPTE everyday viewing", d: comfy },
              { name: "Cinematic", sub: "40° · THX immersive", d: cine },
            ].map((r) => (
              <button
                key={r.name}
                onClick={() => setSettings({ targetDiag: r.d })}
                className={`text-left rounded-2xl p-4 border transition ${
                  s.targetDiag === r.d ? "border-accent bg-accent/15" : "border-line bg-white/[0.04] hover:bg-white/[0.07]"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-2xl font-bold tabular-nums">{fmtDiag(r.d, s.unit)}</div>
                </div>
                <div className="text-xs text-muted mt-1">{r.sub}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            ["sparkles", "Auto-fit", "Point at your TV — Screenfit finds the screen edges for you."],
            ["hand", "Stretch to correct", "Drag corners or pinch until the frame hugs your real screen."],
            ["ruler", "Scale up", "Every size is drawn from that ruler, so 65″ looks exactly like 65″."],
          ].map(([icon, title, body]) => (
            <div key={title} className="card p-5">
              <Icon name={icon} className="size-6 text-accent-2" />
              <div className="font-semibold mt-3">{title}</div>
              <p className="text-sm text-muted mt-1">{body}</p>
            </div>
          ))}
        </section>
      </main>

      {view.kind === "camera" && <CameraAR onExit={() => setView({ kind: "home" })} />}
      {view.kind === "xr" && <XRView calibrate={view.calibrate} onExit={() => setView({ kind: "home" })} />}
    </>
  );
}
