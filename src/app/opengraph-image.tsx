import { ImageResponse } from "next/og";
import { profile } from "@/content";

export const alt = `${profile.name} — ${profile.roles.join(" · ")}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview card, generated at build time. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#07090b",
          color: "#e9e6de",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: "#8d959a" }}>
          {profile.roles.join("   /   ").toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 124, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            {profile.name.toUpperCase()}
          </div>
          <div style={{ display: "flex", width: 1056, height: 3, background: "#f5a623", marginTop: 36 }} />
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.35, color: "#8d959a", marginTop: 36, maxWidth: 940 }}>
            {profile.statement}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
