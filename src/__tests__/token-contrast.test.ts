import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the contrast minimums in `.agents/context/ACCESSIBILITY.md` (WCAG 2.2
 * AA) against token edits, in both themes. Pairs listed here are ones that
 * actually render — see the file's decorative exceptions for what's excluded:
 * `--border`/`--divider` (container boundaries and separators, not controls)
 * and cover-art colors.
 */

const css = readFileSync("src/index.css", "utf8");

function blockVars(startPattern: RegExp): Record<string, string> {
  const start = css.search(startPattern);
  if (start < 0) throw new Error(`token block not found: ${startPattern}`);

  const open = css.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }

  const vars: Record<string, string> = {};
  for (const match of css
    .slice(open, end)
    .matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

const light = blockVars(/^:root \{/m);
const dark = { ...light, ...blockVars(/^\.dark \{/m) };

function srgbGamma(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  const s =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

// Inverse of the OKLab/OKLCh matrices (Björn Ottosson) — oklch() token -> sRGB channels.
function oklchToChannels(
  l: number,
  c: number,
  h: number,
): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;

  const r = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const g = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const bl = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;

  return [srgbGamma(r), srgbGamma(g), srgbGamma(bl)];
}

function channels(value: string): [number, number, number] {
  const oklch = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(value);
  if (oklch) {
    return oklchToChannels(
      Number(oklch[1]) / 100,
      Number(oklch[2]),
      Number(oklch[3]),
    );
  }

  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (!hex)
    throw new Error(`expected an oklch() or 6-digit hex token, got: ${value}`);
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function contrast(a: string, b: string): number {
  const luminance = (value: string) =>
    channels(value)
      .map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i] * c, 0);

  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum ratio, what it is] */
const TEXT_PAIRS: [string, string, number, string][] = [
  ["--foreground", "--background", 4.5, "body text on page"],
  ["--card-foreground", "--card", 4.5, "text on card"],
  ["--popover-foreground", "--popover", 4.5, "text in sheet/popover"],
  ["--muted-foreground", "--background", 4.5, "muted text on page"],
  ["--muted-foreground", "--card", 4.5, "muted text on card"],
  ["--muted-foreground", "--surface-high", 4.5, "muted text on surface-high"],
  ["--secondary-foreground", "--secondary", 4.5, "secondary button label"],
  ["--accent-foreground", "--accent", 4.5, "accent item label"],
  ["--primary-foreground", "--primary", 4.5, "primary button label"],
  ["--destructive-foreground", "--destructive", 4.5, "destructive label"],
  ["--destructive", "--background", 4.5, "destructive text on page"],
  ["--destructive", "--card", 4.5, "destructive text on card"],
  ["--warm-accent-foreground", "--warm-accent", 4.5, "FAB / banner label"],
];

/** Non-text UI: control boundaries and state indicators (WCAG 1.4.11). */
const UI_PAIRS: [string, string, number, string][] = [
  ["--input", "--background", 3, "control boundary on page"],
  ["--input", "--card", 3, "control boundary on card"],
  ["--input", "--surface-high", 3, "control boundary on surface-high"],
  ["--ring", "--background", 3, "focus ring on page"],
  ["--ring", "--card", 3, "focus ring on card"],
  ["--ring", "--surface-high", 3, "focus ring on surface-high"],
  ["--selected", "--background", 3, "selected state on page"],
  ["--selected", "--card", 3, "selected state on card"],
  ["--warm-accent", "--background", 3, "FAB against page"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_theme, tokens) => {
  it.each([...TEXT_PAIRS, ...UI_PAIRS])(
    "%s on %s is at least %s:1 (%s)",
    (fg, bg, minimum) => {
      expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(minimum);
    },
  );
});
