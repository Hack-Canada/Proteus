import { ImageResponse } from "next/og";

import { eventDatesLabel, eventVenue, hackathonYear } from "@/config/site";
import { Cloud, loadFont, loadLogo, NAVY, SEA_GRADIENT, SKY_GRADIENT } from "@/lib/og";

export const alt = `Hack Canada ${hackathonYear} Admin. ${eventDatesLabel} at the ${eventVenue}.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [logoSrc, display, body] = await Promise.all([
    loadLogo(),
    loadFont("Londrina Solid", 900),
    loadFont("Inter", 700),
  ]);
  const fonts = [
    display && { name: "Londrina", data: display, weight: 900 as const },
    body && { name: "Inter", data: body, weight: 700 as const },
  ].filter((font) => !!font);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        fontFamily: "Inter",
        background: SKY_GRADIENT,
      }}
    >
      <Cloud x={760} y={402} s={0.9} />
      <Cloud x={-40} y={420} s={0.75} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          borderTop: "8px solid rgba(255,255,255,0.7)",
          background: SEA_GRADIENT,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: 64,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "Londrina",
              fontSize: 108,
              lineHeight: 0.92,
              color: "#fff",
              textShadow: "0 6px 0 rgba(4,50,81,0.2)",
            }}
          >
            Hack Canada
          </div>
          <div
            style={{
              fontFamily: "Londrina",
              fontSize: 108,
              lineHeight: 0.92,
              color: NAVY,
            }}
          >
            Admin
          </div>
          <div style={{ marginTop: 28, fontSize: 32, color: NAVY }}>
            {`${hackathonYear} · ${eventDatesLabel}`}
          </div>
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        width={300}
        height={300}
        alt=""
        style={{
          position: "absolute",
          right: 80,
          top: 56,
          borderRadius: 9999,
          border: "10px solid #fff",
          transform: "rotate(-8deg)",
        }}
      />
    </div>,
    { ...size, fonts },
  );
}
