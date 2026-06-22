import { ImageResponse } from "next/og";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0a0a0b",
        color: "#f9f9fb",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 800 }}>
        {dictionary["brand-name"]}
      </div>
      <div style={{ color: "#a1a1aa", fontSize: 34, marginTop: 24 }}>
        {dictionary.header["search-try-searching"]}
      </div>
    </div>,
    size,
  );
}
