import { ImageResponse } from "next/og";
import { SOCIAL_PAGES, type SocialPage } from "./social";
export function socialImage(key: SocialPage) {
  const p = SOCIAL_PAGES[key];
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#1e1c1f",
        color: "#f4f2f5",
        fontFamily: "sans-serif",
        padding: "50px 54px",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 42,
              height: 42,
              background: "#b8aaeb",
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <rect
                x="2"
                y="2"
                width="10"
                height="10"
                rx="1"
                stroke="#24212d"
                strokeWidth="2"
                fill="none"
              />
              <rect
                x="16"
                y="2"
                width="10"
                height="10"
                rx="1"
                stroke="#24212d"
                strokeWidth="2"
                fill="none"
              />
              <rect
                x="2"
                y="16"
                width="10"
                height="10"
                rx="1"
                stroke="#24212d"
                strokeWidth="2"
                fill="none"
              />
              <rect
                x="16"
                y="16"
                width="10"
                height="10"
                rx="1"
                fill="#24212d"
              />
            </svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>TypeSafe AI</div>
          <div style={{ fontSize: 15, color: "#aaa6af", marginLeft: 10 }}>
            PLAYGROUND
          </div>
        </div>
        <div style={{ fontSize: 13, letterSpacing: 2, color: "#b8aaeb" }}>
          {p.category}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 46 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 590 }}>
          <div
            style={{
              fontSize: key === "ast-governance" ? 65 : 72,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: -3,
            }}
          >
            {p.title}
          </div>
          <div
            style={{
              fontSize: 27,
              color: "#bcb7c3",
              lineHeight: 1.4,
              marginTop: 24,
              maxWidth: 540,
            }}
          >
            {p.description}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 365,
            padding: 24,
            border: "1px solid #48414f",
            background: "#27242b",
            borderRadius: 16,
            gap: 20,
          }}
        >
          {p.steps.map((step, i) => (
            <div
              key={step}
              style={{ display: "flex", gap: 14, alignItems: "center" }}
            >
              <div
                style={{
                  display: "flex",
                  width: 30,
                  height: 30,
                  background: "#383042",
                  color: "#c4b6ed",
                  borderRadius: 7,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 20, color: "#e7e2ed" }}>{step}</div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              background: "#b8aaeb",
              color: "#211c2d",
              borderRadius: 8,
              padding: "16px 12px",
              fontSize: 17,
              fontWeight: 700,
              marginTop: 6,
              justifyContent: "center",
            }}
          >
            {p.result}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #3b353f",
          paddingTop: 22,
          justifyContent: "space-between",
          color: "#a9a2b2",
          fontSize: 16,
        }}
      >
        <div>Small model. Clear choices.</div>
        <div>
          {p.path === "/" ? "typesafe-ai-playground.vercel.app" : p.path}
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
