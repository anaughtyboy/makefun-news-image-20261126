// THE THURSDAY GLOBE — front page for Thursday 26 November 2026.
// Draws the whole 1024x1024 newspaper page in code: a hand-rolled 5x7
// bitmap font, a small software rasterizer, and a from-scratch PNG
// encoder. No assets, no network, no randomness — two runs write the
// same bytes.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;

// ---- palette ---------------------------------------------------------
const PAPER: RGB = [246, 241, 229];
const INK: RGB = [26, 26, 26];
const RED: RGB = [176, 42, 32];
const BLUE: RGB = [31, 78, 121];
const SKY: RGB = [157, 184, 200];
const SKY_DARK: RGB = [96, 120, 140];
const CLOUD: RGB = [232, 236, 238];
const SUN: RGB = [232, 178, 64];
const SEA: RGB = [58, 110, 138];
const SAND: RGB = [214, 196, 150];
const GREEN: RGB = [74, 110, 62];
const GREY: RGB = [120, 120, 116];
const DARK: RGB = [52, 52, 52];
const ORANGE: RGB = [224, 122, 42];
const YELLOW: RGB = [240, 200, 64];
const WHITE: RGB = [250, 250, 248];
const BROWN: RGB = [122, 84, 52];

type RGB = [number, number, number];

// Optional clip rectangle: illustration paint stays inside its own box.
let clipX = 0;
let clipY = 0;
let clipW = W;
let clipH = H;

function setClip(x: number, y: number, w: number, h: number): void {
  clipX = x;
  clipY = y;
  clipW = w;
  clipH = h;
}

function resetClip(): void {
  clipX = 0;
  clipY = 0;
  clipW = W;
  clipH = H;
}

// ---- pixel buffer ----------------------------------------------------
const img = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  img[i * 3] = PAPER[0];
  img[i * 3 + 1] = PAPER[1];
  img[i * 3 + 2] = PAPER[2];
}

function px(x: number, y: number, c: RGB): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < clipX || yi < clipY || xi >= clipX + clipW || yi >= clipY + clipH) return;
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const o = (yi * W + xi) * 3;
  img[o] = c[0];
  img[o + 1] = c[1];
  img[o + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  rect(x, y, t, h, c);
}

// Bresenham line, with a square brush of side t.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(t / 2);
  for (;;) {
    rect(x - half, y - half, t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let xx = cx - dx; xx <= cx + dx; xx++) px(xx, cy + dy, c);
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const f = 1 - (dy * dy) / (ry * ry);
    if (f < 0) continue;
    const dx = Math.floor(rx * Math.sqrt(f));
    for (let xx = cx - dx; xx <= cx + dx; xx++) px(xx, cy + dy, c);
  }
}

// Filled triangle by scanline interpolation.
function tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: RGB): void {
  const minY = Math.max(0, Math.ceil(Math.min(y1, y2, y3)));
  const maxY = Math.min(H - 1, Math.floor(Math.max(y1, y2, y3)));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x1, y1, x2, y2],
      [x2, y2, x3, y3],
      [x3, y3, x1, y1],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.max(0, Math.ceil(Math.min(...xs)));
      const hi = Math.min(W - 1, Math.floor(Math.max(...xs)));
      for (let x = lo; x <= hi; x++) px(x, y, c);
    }
  }
}

// ---- 5x7 bitmap font -------------------------------------------------
// Each glyph is 7 rows of 5 cells; '#' is ink, '.' is empty.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

function drawGlyph(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") rect(x + col * s, y + r * s, s, s, c);
    }
  }
}

// Advance per character at scale s is 6*s.
function textWidth(text: string, s: number): number {
  return text.length * 6 * s - s;
}

function drawText(text: string, x: number, y: number, s: number, c: RGB): void {
  const up = text.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    drawGlyph(up[i], x + i * 6 * s, y, s, c);
  }
}

function drawTextCentered(text: string, cx: number, y: number, s: number, c: RGB): void {
  drawText(text, cx - Math.floor(textWidth(text, s) / 2), y, s, c);
}

// Greedy word wrap: lines of at most maxChars characters.
function wrap(text: string, maxChars: number): string[] {
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawBlock(lines: string[], x: number, y: number, s: number, c: RGB, lh: number): void {
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, s, c));
}

// ---- PNG encoder -----------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- illustrations (all wordless, drawn in code) ---------------------

// 1. Lead: Macy's parade balloon fighting a storm over the skyline.
function drawParade(x: number, y: number, w: number, h: number): void {
  // Storm sky in three bands, darker toward the top.
  rect(x, y, w, Math.floor(h * 0.34), SKY_DARK);
  rect(x, y + Math.floor(h * 0.34), w, Math.floor(h * 0.33), SKY);
  rect(x, y + Math.floor(h * 0.67), w, h - Math.floor(h * 0.67), [178, 198, 210]);
  // Racing cloud streaks.
  ellipse(x + Math.floor(w * 0.14), y + Math.floor(h * 0.16), 90, 16, CLOUD);
  ellipse(x + Math.floor(w * 0.62), y + Math.floor(h * 0.1), 110, 18, CLOUD);
  ellipse(x + Math.floor(w * 0.86), y + Math.floor(h * 0.3), 80, 14, CLOUD);
  // Skyline along the bottom, drawn before the balloon so no tower
  // slices through it.
  const base = y + h;
  const towers: Array<[number, number]> = [
    [0, 66], [64, 92], [140, 58], [210, 84], [292, 62], [360, 96], [452, 70],
    [540, 88], [620, 60], [700, 94], [790, 66], [868, 86], [920, 64],
  ];
  for (const [tx, th] of towers) {
    rect(x + tx, base - th, 58, th, DARK);
  }
  // Tiny crowd dots on the street.
  for (let i = 0; i < 40; i++) {
    circle(x + 20 + i * 23, base - 8, 3, INK);
  }
  // Wind streaks slanting across the sky.
  for (let i = 0; i < 7; i++) {
    const yy = y + 18 + i * 26;
    line(x + 30 + i * 40, yy, x + 150 + i * 40, yy - 10, WHITE, 3);
  }
  // The balloon: a big tilted round balloon, red with white panels.
  const cx = x + Math.floor(w * 0.42);
  const cy = y + Math.floor(h * 0.42);
  const rx = 120;
  const ry = 96;
  for (let yy = cy - ry; yy <= cy + ry; yy++) {
    const f = 1 - ((yy - cy) * (yy - cy)) / (ry * ry);
    if (f < 0) continue;
    const dx = Math.floor(rx * Math.sqrt(f));
    for (let xx = cx - dx; xx <= cx + dx; xx++) {
      // Vertical panel stripes inside the balloon.
      const stripe = Math.floor((xx - (cx - rx)) / 34) % 2 === 0;
      px(xx, yy, stripe ? RED : WHITE);
    }
  }
  // Balloon outline.
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    px(cx + Math.cos(rad) * rx, cy + Math.sin(rad) * ry, INK);
    px(cx + Math.cos(rad) * (rx - 1), cy + Math.sin(rad) * (ry - 1), INK);
  }
  // Basket and ropes.
  const bx = cx - 16;
  const by = cy + ry + 26;
  line(cx - 60, cy + ry - 6, bx + 4, by, INK, 2);
  line(cx + 60, cy + ry - 6, bx + 28, by, INK, 2);
  line(cx, cy + ry - 4, bx + 16, by, INK, 2);
  rect(bx, by, 32, 22, BROWN);
}

// 2. Kim: a missile on its launcher against mountains.
function drawMissile(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [214, 222, 214]);
  // Mountain range.
  tri(x, y + h, x + Math.floor(w * 0.3), y + Math.floor(h * 0.3), x + Math.floor(w * 0.62), y + h, GREY);
  tri(x + Math.floor(w * 0.45), y + h, x + Math.floor(w * 0.75), y + Math.floor(h * 0.18), x + w, y + h, DARK);
  // Launch pad.
  rect(x + Math.floor(w * 0.36), y + h - 26, Math.floor(w * 0.28), 26, GREY);
  // Rocket body.
  const rx = x + Math.floor(w * 0.5);
  const top = y + Math.floor(h * 0.16);
  const bot = y + h - 26;
  rect(rx - 13, top + 26, 26, bot - top - 26, WHITE);
  tri(rx - 13, top + 26, rx + 13, top + 26, rx, top, RED);
  tri(rx - 13, bot - 14, rx - 30, bot + 2, rx - 13, bot, RED);
  tri(rx + 13, bot - 14, rx + 30, bot + 2, rx + 13, bot, RED);
  // Flame.
  tri(rx - 10, bot, rx + 10, bot, rx, bot + 22, ORANGE);
  tri(rx - 5, bot, rx + 5, bot, rx, bot + 14, YELLOW);
  // Small flag on the pad.
  line(x + Math.floor(w * 0.68), y + h - 26, x + Math.floor(w * 0.68), y + h - 58, INK, 2);
  tri(x + Math.floor(w * 0.68), y + h - 58, x + Math.floor(w * 0.68) + 22, y + h - 51, x + Math.floor(w * 0.68), y + h - 44, RED);
}

// 3. Bomber: a swept-wing bomber over the sea off a coastline.
function drawBomber(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, Math.floor(h * 0.62), SKY);
  rect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), SEA);
  // Sun and clouds.
  circle(x + Math.floor(w * 0.86), y + Math.floor(h * 0.16), 18, SUN);
  ellipse(x + Math.floor(w * 0.2), y + Math.floor(h * 0.14), 70, 12, CLOUD);
  // Wave lines on the sea.
  for (let i = 0; i < 4; i++) {
    const yy = y + Math.floor(h * 0.68) + i * 12;
    line(x + 20 + i * 60, yy, x + 120 + i * 60, yy, WHITE, 2);
  }
  // Coastline strip with a small island.
  rect(x, y + h - 22, w, 22, SAND);
  ellipse(x + Math.floor(w * 0.72), y + h - 24, 46, 12, GREEN);
  tri(x + Math.floor(w * 0.72) - 4, y + h - 36, x + Math.floor(w * 0.72) + 4, y + h - 36, x + Math.floor(w * 0.72), y + h - 52, GREEN);
  // The bomber: long fuselage, swept wings, twin tail.
  const bx = x + Math.floor(w * 0.42);
  const by = y + Math.floor(h * 0.45);
  ellipse(bx, by, 78, 12, DARK);
  tri(bx - 70, by - 4, bx - 10, by - 4, bx - 46, by - 40, DARK);
  tri(bx - 70, by + 4, bx - 10, by + 4, bx - 46, by + 26, DARK);
  tri(bx + 58, by - 4, bx + 78, by - 4, bx + 66, by - 26, DARK);
  tri(bx + 58, by + 4, bx + 78, by + 4, bx + 66, by + 22, DARK);
  circle(bx + 76, by, 5, DARK);
  // Distance marker dots trailing behind.
  for (let i = 0; i < 5; i++) circle(bx - 108 - i * 16, by + 4, 2, DARK);
}

// 4. Musk: a rocket climbing past the stars, Earth below.
function drawRocket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [24, 32, 48]);
  // Stars.
  const stars: Array<[number, number, number]> = [
    [0.08, 0.14, 2], [0.22, 0.08, 2], [0.78, 0.1, 3], [0.9, 0.3, 2],
    [0.12, 0.42, 2], [0.86, 0.55, 2], [0.3, 0.6, 2], [0.66, 0.72, 2],
    [0.05, 0.68, 2], [0.94, 0.68, 2],
  ];
  for (const [fx, fy, r] of stars) circle(x + Math.floor(w * fx), y + Math.floor(h * fy), r, WHITE);
  // Earth arc along the bottom.
  circle(x + Math.floor(w * 0.5), y + h + 190, 230, BLUE);
  ellipse(x + Math.floor(w * 0.32), y + h - 8, 60, 12, GREEN);
  ellipse(x + Math.floor(w * 0.68), y + h - 4, 44, 9, GREEN);
  // Rocket.
  const rx = x + Math.floor(w * 0.5);
  const top = y + Math.floor(h * 0.12);
  const bot = y + Math.floor(h * 0.62);
  rect(rx - 11, top + 22, 22, bot - top - 22, WHITE);
  tri(rx - 11, top + 22, rx + 11, top + 22, rx, top, RED);
  tri(rx - 11, bot - 12, rx - 26, bot + 2, rx - 11, bot, RED);
  tri(rx + 11, bot - 12, rx + 26, bot + 2, rx + 11, bot, RED);
  circle(rx, top + 38, 5, BLUE);
  // Flame and smoke.
  tri(rx - 9, bot, rx + 9, bot, rx, bot + 26, ORANGE);
  tri(rx - 4, bot, rx + 4, bot, rx, bot + 16, YELLOW);
  circle(rx - 18, bot + 30, 8, CLOUD);
  circle(rx + 16, bot + 34, 10, CLOUD);
}

// 5. Army: a controlled blast over a bunker in the Iowa fields.
function drawBlast(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, Math.floor(h * 0.6), SKY);
  rect(x, y + Math.floor(h * 0.6), w, h - Math.floor(h * 0.6), [196, 178, 130]);
  // Field rows.
  for (let i = 0; i < 4; i++) {
    line(x, y + Math.floor(h * 0.66) + i * 10, x + w, y + Math.floor(h * 0.62) + i * 10, BROWN, 2);
  }
  // Bunker.
  const bx = x + Math.floor(w * 0.5);
  const by = y + h - 18;
  rect(bx - 70, by - 34, 140, 34, GREY);
  tri(bx - 70, by - 34, bx + 70, by - 34, bx, by - 52, GREY);
  // Blast: radiating spikes, then hot core.
  const cx = bx;
  const cy = by - 36;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    const x2 = cx + Math.cos(rad) * 52;
    const y2 = cy + Math.sin(rad) * 52;
    const x3 = cx + Math.cos(rad + 0.26) * 34;
    const y3 = cy + Math.sin(rad + 0.26) * 34;
    tri(cx, cy, x2, y2, x3, y3, ORANGE);
  }
  circle(cx, cy, 34, ORANGE);
  circle(cx, cy, 22, YELLOW);
  circle(cx, cy, 11, WHITE);
  // Smoke puffs.
  circle(cx - 52, cy - 30, 13, CLOUD);
  circle(cx + 50, cy - 38, 15, CLOUD);
  circle(cx + 66, cy - 14, 10, CLOUD);
}

// 6. FedEx: a cargo plane past the end of the runway, dust behind it.
function drawPlane(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, Math.floor(h * 0.66), SKY);
  ellipse(x + Math.floor(w * 0.16), y + Math.floor(h * 0.16), 56, 11, CLOUD);
  ellipse(x + Math.floor(w * 0.8), y + Math.floor(h * 0.1), 64, 12, CLOUD);
  // Ground and runway.
  rect(x, y + Math.floor(h * 0.66), w, h - Math.floor(h * 0.66), GREEN);
  const ry = y + Math.floor(h * 0.78);
  rect(x, ry, Math.floor(w * 0.78), 16, GREY);
  for (let i = 0; i < 7; i++) rect(x + 12 + i * 30, ry + 7, 16, 3, WHITE);
  // Control tower.
  rect(x + Math.floor(w * 0.84), ry - 44, 10, 44, GREY);
  rect(x + Math.floor(w * 0.84) - 8, ry - 58, 26, 14, BLUE);
  // The plane, nose past the runway end, on the grass.
  const px0 = x + Math.floor(w * 0.6);
  const py = ry - 6;
  ellipse(px0 + 60, py - 12, 62, 10, WHITE);
  tri(px0 + 108, py - 16, px0 + 128, py - 16, px0 + 118, py - 42, RED);
  tri(px0 + 30, py - 14, px0 + 60, py - 14, px0 + 44, py - 34, GREY);
  tri(px0 + 30, py - 8, px0 + 60, py - 8, px0 + 44, py + 6, GREY);
  circle(px0 + 118, py - 12, 4, BLUE);
  // Dust kicked up behind the wheels.
  circle(px0 + 8, py + 4, 9, [214, 196, 160]);
  circle(px0 - 8, py + 2, 12, [214, 196, 160]);
  circle(px0 - 26, py + 6, 8, [214, 196, 160]);
}

// ---- page layout -----------------------------------------------------
// Masthead.
function drawMasthead(): void {
  // Double border.
  hline(8, 8, W - 16, INK, 3);
  hline(8, H - 11, W - 16, INK, 3);
  vline(8, 8, H - 16, INK, 3);
  vline(W - 11, 8, H - 16, INK, 3);
  drawTextCentered("THE THURSDAY GLOBE", W / 2, 30, 8, INK);
  drawText("EST. 1882", 36, 102, 2, INK);
  drawTextCentered("THURSDAY 26 NOVEMBER 2026", W / 2, 100, 3, INK);
  const price = "ONE DOLLAR";
  drawText(price, W - 36 - textWidth(price, 2), 102, 2, INK);
  hline(36, 132, W - 72, INK, 3);
  hline(36, 138, W - 72, INK, 1);
}

// Lead story: the postponed parade.
function drawLead(): void {
  drawText("MACY'S PARADE POSTPONED", 36, 152, 3, INK);
  drawText("FIRST TIME EVER AS STORM HITS NEW YORK", 36, 180, 3, INK);
  setClip(36, 210, 980, 250);
  drawParade(36, 210, 952, 250);
  resetClip();
  const body = wrap(
    "Organisers call off the Thanksgiving Day parade as powerful winds threaten the balloons and the crowds in New York.",
    79,
  );
  drawBlock(body, 36, 472, 2, INK, 18);
  hline(36, 514, W - 72, INK, 2);
}

// Two-column row: Kim and the bomber.
function drawRowA(): void {
  setClip(36, 528, 462, 120);
  drawMissile(36, 528, 462, 120);
  resetClip();
  setClip(526, 528, 462, 120);
  drawBomber(526, 528, 462, 120);
  resetClip();
  const kimHead = wrap("Kim vows more nuclear weapons", 38);
  drawBlock(kimHead, 36, 656, 2, INK, 16);
  const kimBody = wrap(
    "North Korea's leader inspects nuclear material plants and orders a bigger arsenal, ignoring Washington's overtures.",
    77,
  );
  drawBlock(kimBody, 36, 694, 1, INK, 9);
  const bomHead = wrap("Manila to raise bomber flight with Beijing", 38);
  drawBlock(bomHead, 526, 656, 2, INK, 16);
  const bomBody = wrap(
    "The Philippines says a Chinese H-6 flew 45 nautical miles off Luzon, its closest pass yet, and will take it up with China.",
    77,
  );
  drawBlock(bomBody, 526, 694, 1, INK, 9);
  hline(36, 736, W - 72, INK, 2);
}

// Three-column row: Musk, the Army blast, the FedEx plane.
function drawRowB(): void {
  setClip(36, 750, 301, 120);
  drawRocket(36, 750, 301, 120);
  resetClip();
  setClip(361, 750, 301, 120);
  drawBlast(361, 750, 301, 120);
  resetClip();
  setClip(686, 750, 301, 120);
  drawPlane(686, 750, 301, 120);
  resetClip();
  const mHead = wrap("Musk: two SpaceX shares for every child", 25);
  drawBlock(mHead, 36, 878, 2, INK, 16);
  const mBody = wrap("Elon Musk says every child in America will receive two shares of SpaceX.", 50);
  drawBlock(mBody, 36, 916, 1, INK, 9);
  const aHead = wrap("Army blows up toxic explosives stockpile", 25);
  drawBlock(aHead, 361, 878, 2, INK, 16);
  const aBody = wrap("The U.S. Army detonates its ageing lead azide stockpile in Iowa and calls the blast a success.", 50);
  drawBlock(aBody, 361, 916, 1, INK, 9);
  const fHead = wrap("FedEx plane runs off Miami runway", 25);
  drawBlock(fHead, 686, 878, 2, INK, 16);
  const fBody = wrap("A FedEx cargo plane overshoots the runway at Miami airport.", 50);
  drawBlock(fBody, 686, 916, 1, INK, 9);
  hline(36, 962, W - 72, INK, 1);
  drawTextCentered(
    "SIX STORIES FROM THURSDAY 26 NOVEMBER 2026 - DRAWN AND WRITTEN IN CODE",
    W / 2,
    974,
    1,
    INK,
  );
}

function buildPage(): Buffer {
  drawMasthead();
  drawLead();
  drawRowA();
  drawRowB();
  return encodePNG();
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = buildPage();
  writeFileSync(join(outDir, "entry.png"), png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${join(outDir, "entry.png")} (${png.length} bytes, sha256 ${sha})`);
}

main();
