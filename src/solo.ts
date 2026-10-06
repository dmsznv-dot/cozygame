import RAPIER from "@dimforge/rapier3d-compat";
import { Room } from "../shared/room";
import type { V3 } from "../shared/game";
let ready: Promise<void> | undefined;
export async function createSolo(name: string, color: string) {
  await (ready ??= RAPIER.init());
  const room = new Room("SOLO", true);
  const seat = room.join(name, color);
  let accumulator = 0;
  return {
    id: seat.player.id,
    notes: room.soloNotes,
    pose(data: { pos: V3; yaw: number; pitch: number; point: boolean }) {
      Object.assign(seat.player, { ...data, pos: { ...data.pos } });
    },
    action(data: unknown) {
      room.action(seat.player.id, data);
    },
    tick(dt: number) {
      accumulator += dt;
      while (accumulator >= 1 / 30) {
        room.tick();
        accumulator -= 1 / 30;
      }
    },
    snapshot: () => room.snapshot(),
    dispose: () => room.dispose(),
  };
}
export type SoloSession = Awaited<ReturnType<typeof createSolo>>;
