import * as THREE from "three";
import { buildTV, disposeGroup } from "./tvModel";
import type { Aspect } from "./tv";

export function supportsQuickLook() {
  if (typeof document === "undefined") return false;
  return document.createElement("a").relList.supports("ar");
}

/**
 * iPhone/iPad true-scale AR: export a TV on a small stand to USDZ and open it in
 * AR Quick Look with scaling disabled, so it always shows at real size.
 */
export async function openQuickLook(diag: number, aspect: Aspect, scale: number) {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const { group, H, bezel } = buildTV(diag, aspect, scale, { stand: true });
  group.position.y = H / 2 + bezel + 0.092; // base sits on the surface
  const root = new THREE.Group();
  root.add(group);
  root.updateMatrixWorld(true);
  const buf = await new USDZExporter().parseAsync(root, {
    quickLookCompatible: true,
    ar: { anchoring: { type: "plane" }, planeAnchoring: { alignment: "horizontal" } },
  });
  disposeGroup(root);
  const url = URL.createObjectURL(new Blob([buf], { type: "model/vnd.usdz+zip" }));
  const a = document.createElement("a");
  a.rel = "ar";
  a.href = `${url}#allowsContentScaling=0`;
  a.appendChild(document.createElement("img"));
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
