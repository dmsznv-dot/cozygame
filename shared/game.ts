import { SOLIDS, overlaps, STATIONS } from "./level.ts";
export { STATIONS, TREES, WALLS } from "./level.ts";
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
export type Player = {
  id: string;
  name: string;
  color: string;
  pos: V3;
  yaw: number;
  pitch: number;
  point: boolean;
  online: boolean;
  charge: number;
};
export type Ball = {
  id: number;
  pos: V3;
  heldBy: string | null;
  rotation?: { x: number; y: number; z: number; w: number };
};
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
export function canOccupy(x: number, z: number, p: Progress, eyeY = 1.65) {
  if (Math.abs(x) > 53 || z > 48 || z < -53) return false;
  if (z < -36 && z > -43 && (Math.abs(x) > 1.6 || !solved(p))) return false;
  const feet = eyeY - 1.65;
  if (feet < 1.55 && Math.hypot(x - basketX(p.basketLane), z + 2) < 1.4)
    return false;
  return !SOLIDS.some(
    (s) =>
      overlaps(s, x, z, 0.32) &&
      feet < s.y + s.h / 2 - 0.04 &&
      eyeY > s.y - s.h / 2,
  );
}
export function floorHeight(x: number, z: number, eyeY: number) {
  let height = 0;
  for (const s of SOLIDS) {
    const top = s.y + s.h / 2;
    if (top <= eyeY - 1.65 + 0.12 && overlaps(s, x, z, 0.27))
      height = Math.max(height, top);
  }
  return height;
}
