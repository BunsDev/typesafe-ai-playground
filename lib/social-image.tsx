import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOCIAL_PAGES, type SocialPage } from "./social";
const banner =
  "data:image/jpeg;base64," +
  readFileSync(join(process.cwd(), "public/brand/banner.jpg")).toString(
    "base64",
  );
const mark =
  "data:image/jpeg;base64," +
  readFileSync(join(process.cwd(), "public/brand/mark.jpg")).toString("base64");
const headingFont = readFileSync(
  join(process.cwd(), "public/brand/heading.ttf"),
);
const bodyFont = readFileSync(join(process.cwd(), "public/brand/body.ttf"));
export function socialImage(key: SocialPage) {
  const p = SOCIAL_PAGES[key];
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#faf7f9",
        color: "#201d20",
        fontFamily: "BrandSans",
        padding: "40px 48px",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
      }}
    >
      <img
        src={banner}
        width={1200}
        height={630}
        alt=""
        style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          background:
            "linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.93) 55%,#ffffff 100%)",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#fff",
            border: "1px solid #201d20",
            padding: "8px 14px 8px 8px",
            boxShadow: "4px 4px 0 #201d20",
          }}
        >
          <img src={mark} width={44} height={44} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -1 }}>
              TypeSafe AI
            </div>
            <div style={{ fontSize: 10, letterSpacing: 2 }}>
              COMMUNITY PLAYGROUND
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            letterSpacing: 1,
            background: "#201d20",
            color: "#fff",
            padding: "9px 12px",
          }}
        >
          {p.category}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 40,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 635 }}>
          <div
            style={{
              display: "flex",
              fontSize: 12,
              letterSpacing: 2,
              marginBottom: 18,
            }}
          >
            INTELLIGENCE BEYOND CHAT
          </div>
          <div
            style={{
              fontSize: key === "ast-governance" ? 68 : 78,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -4,
            }}
          >
            {p.title}
          </div>
          <div
            style={{
              fontSize: 25,
              color: "#574a53",
              lineHeight: 1.35,
              marginTop: 20,
              maxWidth: 610,
            }}
          >
            {p.description}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 375,
            border: "2px solid #201d20",
            background: "#fff",
            boxShadow: "6px 6px 0 #201d20",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "#201d20",
              color: "#fff",
              fontSize: 13,
              padding: "8px 12px",
            }}
          >
            Jev / decision workspace
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 22,
              gap: 21,
            }}
          >
            {p.steps.map((step, i) => (
              <div
                key={step}
                style={{ display: "flex", gap: 12, alignItems: "center" }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 27,
                    height: 27,
                    background: "#fbe3f3",
                    border: "1px solid #201d20",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: 18, width: 275 }}>{step}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              background: "#e74cbc",
              borderTop: "1px solid #201d20",
              padding: "15px 14px",
              fontSize: 16,
              fontWeight: 700,
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
          borderTop: "1px solid #201d20",
          paddingTop: 17,
          justifyContent: "space-between",
          fontSize: 13,
          position: "relative",
        }}
      >
        <div>Small model. Clear choices.</div>
        <div>
          {p.path === "/" ? "typesafe-ai-playground.vercel.app" : p.path}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "BrandSans",
          data: new Uint8Array(bodyFont).buffer,
          weight: 400,
          style: "normal",
        },
        {
          name: "BrandSans",
          data: new Uint8Array(headingFont).buffer,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
