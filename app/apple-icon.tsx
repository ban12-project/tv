import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0a0a0b",
        color: "#f9f9fb",
        display: "flex",
        fontFamily: "sans-serif",
        fontSize: 64,
        fontWeight: 800,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      TV
    </div>,
    size,
  );
}
