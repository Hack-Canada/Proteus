import { readFile } from "node:fs/promises";
import path from "node:path";

export const NAVY = "#043251";
export const SKY_GRADIENT =
  "linear-gradient(180deg, #6FA6EA 0%, #9DC5F3 55%, #CFE3F9 100%)";
export const SEA_GRADIENT = "linear-gradient(180deg, #4A8FDB 0%, #255FAE 100%)";

let logo: Promise<string> | null = null;
export function loadLogo() {
  logo ??= readFile(
    path.join(process.cwd(), "public", "hack-canada-logo.png"),
  ).then((file) => `data:image/png;base64,${file.toString("base64")}`);
  return logo;
}

// ponytail: fonts come from Google Fonts on first render, then live in memory.
// If Google is unreachable the image falls back to the default font. Bundle the
// .ttf files if that ever matters.
const fonts = new Map<string, Promise<ArrayBuffer | null>>();
export function loadFont(family: string, weight: number) {
  const key = `${family}:${weight}`;
  let font = fonts.get(key);
  if (!font) {
    font = fetch(
      `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@${weight}`,
    )
      .then((res) => res.text())
      .then((css) => {
        const url = css.match(
          /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
        )?.[1];
        if (!url) throw new Error(`No ttf for ${key}`);
        return fetch(url);
      })
      .then((res) => res.arrayBuffer())
      .catch((error) => {
        fonts.delete(key);
        console.error("OG font failed", error);
        return null;
      });
    fonts.set(key, font);
  }
  return font;
}

export function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  const puff = (left: number, top: number, w: number, h: number) => (
    <div
      style={{
        position: "absolute",
        left: left * s,
        top: top * s,
        width: w * s,
        height: h * s,
        borderRadius: 9999,
        background: "#fff",
      }}
    />
  );
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 240 * s,
        height: 100 * s,
        display: "flex",
        opacity: 0.75,
      }}
    >
      {puff(0, 44, 240, 56)}
      {puff(40, 8, 100, 92)}
      {puff(112, 24, 88, 76)}
    </div>
  );
}
