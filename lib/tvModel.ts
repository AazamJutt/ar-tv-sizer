import * as THREE from "three";
import { dims, IN_TO_M, type Aspect } from "./tv";

function screenTexture(label: string, sub: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 576;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, "#1b1442");
  grad.addColorStop(0.55, "#0f1d4a");
  grad.addColorStop(1, "#073447");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const glow = g.createRadialGradient(c.width * 0.3, c.height * 0.2, 10, c.width * 0.3, c.height * 0.2, c.width * 0.7);
  glow.addColorStop(0, "rgba(124,108,255,0.45)");
  glow.addColorStop(1, "rgba(124,108,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.font = "700 200px system-ui, sans-serif";
  g.fillText(label, c.width / 2, c.height / 2 + 50);
  g.font = "500 44px system-ui, sans-serif";
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.fillText(sub, c.width / 2, c.height / 2 + 130);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A simple flat-panel TV. Origin is at the screen's center; +Z is the front.
 * `scale` is the user's calibration correction for the AR system.
 */
export function buildTV(diag: number, aspect: Aspect, scale = 1, opts: { stand?: boolean } = {}) {
  const { w, h } = dims(diag, aspect);
  const W = w * IN_TO_M * scale;
  const H = h * IN_TO_M * scale;
  const bezel = 0.008;
  const depth = 0.035;
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W + bezel * 2, H + bezel * 2, depth),
    new THREE.MeshStandardMaterial({ color: 0x15161b, metalness: 0.6, roughness: 0.4 }),
  );
  body.position.z = -depth / 2;
  group.add(body);

  // Standard + emissive so it reads as "lit" in WebXR and survives USDZ export for Quick Look.
  const tex = screenTexture(
    `${Number.isInteger(diag) ? diag : diag.toFixed(1)}″`,
    `${(w * 2.54).toFixed(0)} × ${(h * 2.54).toFixed(0)} cm`,
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, roughness: 0.25, metalness: 0 }),
  );
  screen.position.z = 0.001;
  group.add(screen);

  if (opts.stand) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x22242b, metalness: 0.7, roughness: 0.35 });
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.02), mat);
    neck.position.set(0, -H / 2 - bezel - 0.04, -depth / 2);
    const base = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.5, W * 0.4), 0.012, 0.22), mat);
    base.position.set(0, -H / 2 - bezel - 0.08 - 0.006, -depth / 2);
    group.add(neck, base);
  }

  return { group, W, H, bezel, depth };
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      (mat as THREE.MeshBasicMaterial).map?.dispose();
      mat.dispose();
    }
  });
}
