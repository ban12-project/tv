import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0a0a0b",
        color: "#f9f9fb",
        display: "flex",
        fontFamily: "sans-serif",
        fontSize: 22,
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
