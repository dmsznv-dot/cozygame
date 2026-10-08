export const STATIONS = {
  signPlate: { x: -20, z: -8 },
  signPanel: { x: -15, z: -4 },
  lever: { x: 22, z: 5 },
  rack: { x: 15, z: 8 },
  lightPlate: { x: -6, z: -27 },
  lightPanel: { x: 2, z: -24 },
};
// Shared collision geometry for visible buildings and large trees.
export const WALLS = [
  { x: -23, z: -8, w: 0.5, d: 9, h: 4 },
  { x: -17, z: -8, w: 0.5, d: 9, h: 4 },
  { x: -20, z: -12.5, w: 6, d: 0.5, h: 4 },
  { x: -22, z: -3.5, w: 2, d: 0.5, h: 4 },
  { x: -18, z: -3.5, w: 2, d: 0.5, h: 4 },
  { x: -2.6, z: -27, w: 0.4, d: 9, h: 3.5 },
];
export const TREES: Array<{ x: number; z: number; s: number; pine: boolean }> =
  [];
let seed = 821;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
for (let i = 0; i < 180; i++) {
  const x = rand() * 110 - 55,
    z = rand() * 100 - 50;
  if (
    (x > 0 && x < 28 && z > 10 && z < 35) ||
    Math.abs(x) < 5 ||
    (z > -44 && z < -35) ||
    Math.hypot(x, z - 19) < 11 ||
    Object.values(STATIONS).some((p) => Math.hypot(p.x - x, p.z - z) < 8) ||
    (x > 10 && x < 25 && z > -6 && z < 13)
  )
    continue;
  TREES.push({ x, z, s: 0.75 + rand() * 0.65, pine: rand() > 0.48 });
}

export type Solid = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotation?: number;
  kind?: "box" | "cylinder";
  bridge?: boolean;
};
export const LOGS = [
  { x: -8, z: 15 },
  { x: 13, z: 18 },
  { x: -25, z: -1 },
  { x: 7, z: -16 },
];
export const ROCKS: Array<{ x: number; z: number; r: number }> = [];
for (let i = 0; i < 65; i++) {
  const x = Math.sin(i * 21.73) * 44,
    z = Math.cos(i * 8.17) * 37;
  if (
    Math.abs(x) < 5 ||
    Object.values(STATIONS).some((p) => Math.hypot(x - p.x, z - p.z) < 5) ||
    (x > 10 && x < 25 && z > -6 && z < 13)
  )
    continue;
  ROCKS.push({ x, z, r: 0.3 + (i % 4) * 0.15 });
}
export const RUINS = [
  { x: -31, z: 16 },
  { x: 30, z: -19 },
];
export const SOLIDS: Solid[] = [
  ...WALLS.map((w) => ({ ...w, y: w.h / 2 })),
  ...TREES.map((t) => ({
    x: t.x,
    z: t.z,
    y: 3.5 * t.s,
    w: 0.84 * t.s,
    d: 0.84 * t.s,
    h: 7 * t.s,
    kind: "cylinder" as const,
  })),
  ...LOGS.map((p) => ({
    ...p,
    y: 0.37,
    w: 3.5,
    h: 0.74,
    d: 0.8,
    rotation: 0.3,
  })),
  ...ROCKS.map((p) => ({
    x: p.x,
    z: p.z,
    y: p.r * 0.32,
    w: p.r * 2.3,
    d: p.r * 1.7,
    h: p.r * 0.9,
    kind: "cylinder" as const,
  })),
  { x: -20, y: 4.6, z: -8, w: 7.6, h: 1.2, d: 9.5 },
  { x: 22, y: 0.5, z: 5, w: 0.7, h: 1, d: 0.7 },
  { x: 22, y: 1.3, z: 5, w: 0.25, h: 0.6, d: 0.25 },
  { x: 15, y: 0.15, z: 8, w: 3, h: 0.2, d: 1 },
  { x: 17, y: 0.55, z: -2, w: 9, h: 0.15, d: 0.2 },
  { x: 2, y: 0.57, z: -24.8, w: 4, h: 1.15, d: 1 },
  { x: 2, y: 2.1, z: -25, w: 3.6, h: 2.1, d: 0.14 },
  { x: -1, y: 0.6, z: -48, w: 3.5, h: 0.25, d: 0.8 },
  { x: -1, y: 1.05, z: -48.4, w: 3.5, h: 0.75, d: 0.15 },
  ...[-2.2, 0.2].map((x) => ({ x, y: 0.27, z: -48, w: 0.15, h: 0.55, d: 0.6 })),
  ...Array.from({ length: 4 }, (_, i) => ({
    x: -16.5 + i * 1.05,
    y: 1.2,
    z: -4,
    w: 0.92,
    h: 0.92,
    d: 0.16,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    x: -16.5 + i * 1.05,
    y: 0.5,
    z: -4,
    w: 0.13,
    h: 1,
    d: 0.13,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    x: -8 + i,
    y: 1,
    z: -29,
    w: 0.22,
    h: 2.2,
    d: 0.22,
  })),
  ...[-2, 2].map((x) => ({ x, y: 0.55, z: -39.5, w: 0.2, h: 1.1, d: 7.6 })),
  ...RUINS.flatMap((p) =>
    [-1.7, 1.7].map((dx) => ({
      x: p.x + dx,
      y: 1.7,
      z: p.z,
      w: 0.9,
      h: 3.4,
      d: 1,
    })),
  ),
  ...RUINS.map((p) => ({ x: p.x, y: 3.5, z: p.z, w: 4.4, h: 0.6, d: 1.2 })),
];
for (const z of [-35.9, -43.1])
  for (let i = 0; i < 40; i++) {
    const x = -59 + i * 3;
    if (Math.abs(x) < 3) continue;
    const r = 0.6 + (i % 3) * 0.22;
    SOLIDS.push({
      x,
      z: z + Math.sin(i) * 0.4,
      y: 0.05,
      w: r * 2.8,
      h: r * 1.15,
      d: r * 1.8,
      kind: "cylinder",
    });
  }
export function overlaps(s: Solid, x: number, z: number, r = 0) {
  const dx = x - s.x,
    dz = z - s.z,
    c = Math.cos(s.rotation || 0),
    sn = Math.sin(s.rotation || 0);
  const lx = dx * c - dz * sn,
    lz = dx * sn + dz * c;
  if (s.kind === "cylinder")
    return (lx / (s.w / 2 + r)) ** 2 + (lz / (s.d / 2 + r)) ** 2 < 1;
  return Math.abs(lx) < s.w / 2 + r && Math.abs(lz) < s.d / 2 + r;
}
export function clearSegment(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  radius = 0.05,
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / 0.08),
  );
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      x = a.x + (b.x - a.x) * t,
      y = a.y + (b.y - a.y) * t,
      z = a.z + (b.z - a.z) * t;
    if (
      SOLIDS.some(
        (s) =>
          y + radius > s.y - s.h / 2 &&
          y - radius < s.y + s.h / 2 &&
          overlaps(s, x, z, radius),
      )
    )
      return false;
  }
  return true;
}
