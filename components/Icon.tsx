const PATHS: Record<string, React.ReactNode> = {
  x: <path d="M18 6 6 18M6 6l12 12" />,
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  sparkles: (
    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  ),
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M7 4l13 8-13 8z" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  unlock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </>
  ),
  reset: <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  "camera-off": <path d="M2 2l20 20M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5M14.1 14.1a3 3 0 0 1-4.2-4.2" />,
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  cube: <path d="M21 16V8l-9-5-9 5v8l9 5zM3.3 7 12 12l8.7-5M12 22V12" />,
  tv: (
    <>
      <rect x="2" y="5" width="20" height="13" rx="2" />
      <path d="M8 21h8" />
    </>
  ),
  stand: (
    <>
      <rect x="3" y="4" width="18" height="11" rx="1.5" />
      <path d="M12 15v3M6 20h12" />
    </>
  ),
  wall: (
    <>
      <path d="M3 3v18M21 3v18" />
      <rect x="6" y="7" width="12" height="8" rx="1" />
    </>
  ),
  download: <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />,
  ruler: <path d="M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" />,
  sofa: <path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2" />,
  hand: <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  move: <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />,
  up: <path d="m18 15-6-6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
};

export function Icon({ name, className }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
