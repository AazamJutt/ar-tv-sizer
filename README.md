# Screenfit — see your next TV at real size

A Next.js PWA that previews bigger TVs in your room with AR, calibrated against the TV you already own.

## How it works

1. **Tell it your current TV** (e.g. 40″, 16:9).
2. **Calibrate** — point the camera at that TV. Auto-fit finds the screen; drag corners/edges or pinch to stretch the frame until it hugs the real screen. Freeze the image to adjust comfortably, or use a photo.
3. **Scale up** — pick any preset or custom size (slider, ± or pinch). The new TV is drawn from the same ruler, sitting on the same stand or centered on the wall. Save/share a snapshot.

### AR modes

| Mode | Where | How scale is known |
| --- | --- | --- |
| Camera AR | Any phone/browser with a camera | Your real TV is the ruler (calibration) |
| True-scale 3D AR | Android Chrome (WebXR) | Device depth tracking + optional calibration factor (place a virtual 40″ on your 40″, pinch to match) |
| View in 3D AR | iPhone/iPad (AR Quick Look) | Real-size USDZ generated on the fly, scaling locked, uses the same calibration factor |

Plus a size explorer with a to-scale side view and a seating-distance recommender (SMPTE 30° / THX 40°).

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm run dev:phone    # HTTPS on your LAN so the phone camera works
```

Camera and WebXR require HTTPS (localhost is exempt). With `dev:phone`, open `https://<your-computer-ip>:3000` on the phone and accept the self-signed certificate.

The service worker (`public/sw.js`) only registers in production builds: `npm run build && npm start`.

## Code map

- `lib/tv.ts` — size math (dimensions, viewing angle, recommendations)
- `lib/store.ts` — persisted settings (localStorage)
- `lib/detect.ts` — on-device TV detection (dark/bright rectangle finder)
- `components/CameraAR.tsx` — camera overlay: ask → calibrate → compare
- `components/XRView.tsx` — WebXR hit-test placement (floor, table, wall)
- `lib/quicklook.ts` — USDZ export for iOS AR Quick Look
