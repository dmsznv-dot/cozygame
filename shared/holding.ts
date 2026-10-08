import type { Player, V3 } from "./game.ts";
import { clearSegment } from "./level.ts";
export const CHARGE_SECONDS = 1.2;
export function handTarget(
  p: Pick<Player, "pos" | "yaw" | "pitch" | "charge">,
): V3 {
  const charge = p.charge || 0,
    forward = 0.84 - charge * 0.2;
  const localX = 0.32,
    localY = -0.38 - charge * 0.08;
  const cp = Math.cos(p.pitch),
    sp = Math.sin(p.pitch);
  const horizontal = forward * cp + localY * sp;
  const target = {
    x: p.pos.x - Math.sin(p.yaw) * horizontal + Math.cos(p.yaw) * localX,
    y: p.pos.y + sp * forward + cp * localY,
    z: p.pos.z - Math.cos(p.yaw) * horizontal - Math.sin(p.yaw) * localX,
  };
  const start = { x: p.pos.x, y: p.pos.y - 0.12, z: p.pos.z };
  for (let t = 1; t >= 0; t -= 0.08) {
    const point = {
      x: start.x + (target.x - start.x) * t,
      y: start.y + (target.y - start.y) * t,
      z: start.z + (target.z - start.z) * t,
    };
    if (clearSegment(start, point, 0.24)) return point;
  }
  return start;
}
