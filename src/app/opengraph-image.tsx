import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt = "comal.dev - open-source developer playground for composing AI agents";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

const BACKGROUND = "#0a0a0c";
const FOREGROUND = "#fafafa";
const MUTED_FOREGROUND = "#a1a1aa";

const fontData = readFileSync(join(process.cwd(), "assets/JetBrainsMono-Bold.ttf"));
const mascotSvg = readFileSync(join(process.cwd(), "public/mascot.svg"));
const mascotDataUrl = `data:image/svg+xml;base64,${mascotSvg.toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: BACKGROUND,
        color: FOREGROUND,
        display: "flex",
        flexDirection: "column",
        fontFamily: "JetBrains Mono",
        gap: 48,
        height: "100%",
        justifyContent: "center",
        padding: "80px",
        width: "100%",
      }}
    >
      <img alt="" height={240} src={mascotDataUrl} width={240} />
      <div
        style={{
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        comal.dev
      </div>
      <div
        style={{
          color: MUTED_FOREGROUND,
          fontSize: 36,
          fontWeight: 700,
          lineHeight: 1.3,
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        Open-source developer playground for composing your own AI agents
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          data: fontData,
          name: "JetBrains Mono",
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
