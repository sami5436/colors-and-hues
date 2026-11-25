// Color math shared by the server (scoring) and the browser (rendering).

export type RGB = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function linearToSrgb(c: number) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** OKLab to linear sRGB, unclamped. */
function oklabToLinear(L: number, a: number, b: number): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToOklab([r, g, b]: RGB): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const inGamut = (rgb: RGB) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

/** OKLCH to sRGB (0-255), reducing chroma until the color fits the sRGB gamut. */
export function oklchToRgb(L: number, C: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180;
  let lo = 0;
  let hi = C;
  let best = oklabToLinear(L, 0, 0);
  if (inGamut(oklabToLinear(L, C * Math.cos(h), C * Math.sin(h)))) {
    best = oklabToLinear(L, C * Math.cos(h), C * Math.sin(h));
  } else {
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const rgb = oklabToLinear(L, mid * Math.cos(h), mid * Math.sin(h));
      if (inGamut(rgb)) {
        lo = mid;
        best = rgb;
      } else {
        hi = mid;
      }
    }
  }
  return best.map((c) => Math.round(clamp01(linearToSrgb(clamp01(c))) * 255)) as RGB;
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as RGB;
}

export function rgbToHex([r, g, b]: RGB) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export const hslHex = (h: number, s: number, l: number) => rgbToHex(hslToRgb(h, s, l));

/** Perceptual distance between two sRGB colors (OKLab Euclidean, roughly 0 to 0.5). */
export function oklabDistance(a: RGB, b: RGB) {
  const la = linearToOklab(a.map((c) => srgbToLinear(c / 255)) as RGB);
  const lb = linearToOklab(b.map((c) => srgbToLinear(c / 255)) as RGB);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** True when dark text reads better than light text on this color. */
export function prefersDarkText([r, g, b]: RGB) {
  const lum = 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255);
  return lum > 0.22;
}
