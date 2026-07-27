import { ImageResponse } from "next/og";

export const alt = "Job Board: Find your next opportunity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#09090b",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#facc15",
            borderRadius: "26px",
            color: "#09090b",
            display: "flex",
            fontSize: 44,
            fontWeight: 800,
            padding: "24px 30px",
          }}
        >
          JB
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: "-2px",
            marginTop: 42,
          }}
        >
          Find your next opportunity
        </div>
        <div
          style={{
            color: "#d4d4d8",
            display: "flex",
            fontSize: 30,
            marginTop: 24,
          }}
        >
          Quality jobs. Focused hiring.
        </div>
      </div>
    ),
    size,
  );
}
