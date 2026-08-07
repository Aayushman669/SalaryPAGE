import { ImageResponse } from "next/og";

export const alt = "JobForge: Forge Your Future Career";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mark({ scale = 1, x = 0, y = 0 }: { scale?: number; x?: number; y?: number }) {
  const transform = `translate(${x}px, ${y}px) scale(${scale})`;

  return (
    <div style={{ display: "flex", position: "absolute", transform }}>
      <svg height="160" viewBox="0 0 160 160" width="160">
        <path d="M47 36L60 24H128L116 36H47Z" fill="#FACC15" />
        <path d="M57 24H73L67 36H51L57 24Z" fill="#FACC15" />
        <path d="M86 24H101L95 36H80L86 24Z" fill="#FACC15" />
        <path d="M36 119L21 104L44 88L54 47H72L59 102L36 119Z" fill="#FFFFFF" />
        <path d="M61 47H119L106 61H76L73 74H101L88 88H70L63 116H45L61 47Z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A0A",
          display: "flex",
          height: "100%",
          position: "relative",
          width: "100%",
        }}
      >
        <Mark scale={2.35} x={110} y={130} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            left: 430,
            position: "absolute",
            top: 192,
          }}
        >
          <div style={{ display: "flex" }}>
            <span
              style={{
                color: "#FFFFFF",
                fontSize: 101,
                fontWeight: 700,
                letterSpacing: "-2px",
              }}
            >
              Job
            </span>
            <span
              style={{
                color: "#FACC15",
                fontSize: 101,
                fontWeight: 700,
                letterSpacing: "-2px",
                marginLeft: 2,
              }}
            >
              Forge
            </span>
          </div>
          <div
            style={{
              color: "#FFFFFF",
              display: "flex",
              fontSize: 42,
              fontWeight: 400,
              marginTop: 6,
            }}
          >
            Forge Your Future Career
          </div>
        </div>
      </div>
    ),
    size,
  );
}
