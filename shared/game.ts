export type V3 = { x: number; y: number; z: number };
export const COLORS = [
  "#f3bf70",
  "#a6c7a1",
  "#91b9cf",
  "#d8a2b5",
  "#b8a5d2",
  "#eee1bc",
];
export const SYMBOLS = ["лист", "луна", "солнце", "волна"];
export const SIGN_SEQUENCE = [1, 0, 2];
export const LIGHT_COUNTS = [3, 5, 2];
export const LIGHT_CODES: Record<number, number> = {
  1: 4,
  2: 7,
  3: 2,
  4: 9,
  5: 5,
};
export const SPAWN = { x: 0, y: 1.65, z: 20 };
export const STATIONS = {
  signPlate: { x: -20, z: -8 },
  signPanel: { x: -15, z: -4 },
  lever: { x: 22, z: 5 },
  rack: { x: 15, z: 8 },
  lightPlate: { x: -6, z: -27 },
  lightPanel: { x: 2, z: -24 },
};
export type Player = {
  id: string;
  name: string;
  color: string;
  pos: V3;
  yaw: number;
  pitch: number;
  point: boolean;
  online: boolean;
};
export type Ball = { id: number; pos: V3; heldBy: string | null };
export type Progress = {
  signIndex: number;
  signs: boolean;
  throws: number;
  throwDone: boolean;
  lightRound: number;
  lights: boolean;
  basketLane: number;
  operator: string | null;
  notice: string;
};
export type Snapshot = {
  code: string;
  players: Player[];
  balls: Ball[];
  progress: Progress;
  signObserver: string | null;
  lightObserver: string | null;
  time: number;
};
export const initialProgress = (): Progress => ({
  signIndex: 0,
  signs: false,
  throws: 0,
  throwDone: false,
  lightRound: 0,
  lights: false,
  basketLane: 1,
  operator: null,
  notice: "",
});
export const distance = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
export const basketX = (lane: number) => 14 + lane * 3;
export const solved = (p: Progress) => p.signs && p.throwDone && p.lights;
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
    Object.values(STATIONS).some((p) => distance(p, { x, z }) < 8) ||
    (x > 10 && x < 25 && z > -6 && z < 13)
  )
    continue;
  TREES.push({ x, z, s: 0.75 + rand() * 0.65, pine: rand() > 0.28 });
}
export function canOccupy(x: number, z: number, p: Progress) {
  if (Math.abs(x) > 53 || z > 48 || z < -53) return false;
  if (z < -36 && z > -43 && (Math.abs(x) > 2.1 || !solved(p))) return false;
  for (const w of WALLS)
    if (
      Math.abs(x - w.x) < w.w / 2 + 0.35 &&
      Math.abs(z - w.z) < w.d / 2 + 0.35
    )
      return false;
  for (const t of TREES)
    if (Math.hypot(x - t.x, z - t.z) < 0.42 * t.s + 0.35) return false;
  return true;
}
