/** Shared app-icon artwork for ImageResponse routes. */
export function IconArt({ size }: { size: number }) {
  const u = size / 100;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #7c6cff 0%, #3a63ff 55%, #2fd4ff 100%)",
      }}
    >
      <div
        style={{
          width: 62 * u,
          height: 38 * u,
          borderRadius: 5 * u,
          border: `${4.5 * u}px solid white`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 34 * u,
            height: 18 * u,
            borderRadius: 2.5 * u,
            border: `${3 * u}px dashed rgba(255,255,255,0.8)`,
          }}
        />
      </div>
    </div>
  );
}
