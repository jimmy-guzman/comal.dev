import { ImageResponse } from "next/og";

export const alt = "comal.dev - open-source developer playground for composing AI agents";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0a0a0a",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        height: "100%",
        justifyContent: "center",
        padding: "80px",
        width: "100%",
      }}
    >
      <div
        style={{
          color: "#C1622F",
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        comal.dev
      </div>
      <div
        style={{
          color: "#a3a3a3",
          fontSize: 40,
          lineHeight: 1.3,
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        Open-source developer playground for composing and evaluating your own AI agents
      </div>
    </div>,
    size,
  );
}
