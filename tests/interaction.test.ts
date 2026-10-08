import { test } from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Room } from "../shared/room.ts";
import { canOccupy, initialProgress } from "../shared/game.ts";
await RAPIER.init();
const setup = () => {
  const room = new Room("TEST");
  const seat = room.join("A", "#f3bf70");
  return { room, seat };
};
test("logs and station furniture block a walking player", () => {
  const p = initialProgress();
  assert.equal(canOccupy(-8, 15, p), false);
  assert.equal(canOccupy(22, 5, p), false);
  assert.equal(canOccupy(2, -24.8, p), false);
  assert.equal(canOccupy(0, 20, p), true);
});
test("balls hit cabin walls instead of passing through", () => {
  const { room } = setup();
  const b = room.balls[0];
  b.body.setTranslation({ x: -20, y: 1, z: -10 }, true);
  b.body.setLinvel({ x: 0, y: 0, z: -10 }, true);
  for (let i = 0; i < 15; i++) room.tick();
  assert.ok(b.pos.z > -12.3, `ball escaped wall at ${b.pos.z}`);
  room.dispose();
});
test("pickup cannot reach a ball through a wall", () => {
  const { room, seat } = setup();
  seat.player.pos = { x: -16.2, y: 1.65, z: -8 };
  room.balls[0].pos = { x: -18, y: 1, z: -8 };
  room.action(seat.player.id, { kind: "pickup" });
  assert.equal(room.balls[0].heldBy, null);
  room.dispose();
});
test("gentle drop releases held ball with low velocity", () => {
  const { room, seat } = setup();
  seat.player.pos = { x: 15, y: 1.65, z: 9.5 };
  room.action(seat.player.id, { kind: "pickup" });
  room.tick();
  const b = room.balls.find((b) => b.heldBy === seat.player.id)!;
  assert.ok(b);
  room.action(seat.player.id, { kind: "drop" });
  assert.equal(b.heldBy, null);
  assert.ok(Math.hypot(...Object.values(b.body.linvel())) < 2);
  room.dispose();
});
test("holding throw increases release speed; cancelling preserves the held ball", () => {
  const speed = (ticks: number) => {
    const { room, seat } = setup();
    seat.player.pos = { x: 15, y: 1.65, z: 9.5 };
    room.action(seat.player.id, { kind: "pickup" });
    room.action(seat.player.id, { kind: "charge" });
    for (let i = 0; i < ticks; i++) room.tick();
    const b = room.balls.find((b) => b.heldBy === seat.player.id)!;
    room.action(seat.player.id, {
      kind: "throw",
      direction: { x: 0, y: 0.15, z: -1 },
    });
    const v = b.body.linvel();
    const s = Math.hypot(v.x, v.y, v.z);
    room.dispose();
    return s;
  };
  assert.ok(speed(40) > speed(1) + 5);
  const { room, seat } = setup();
  seat.player.pos = { x: 15, y: 1.65, z: 9.5 };
  room.action(seat.player.id, { kind: "pickup" });
  room.action(seat.player.id, { kind: "charge" });
  room.tick();
  room.action(seat.player.id, { kind: "cancelThrow" });
  assert.ok(room.balls.some((b) => b.heldBy === seat.player.id));
  room.dispose();
});
test("carried ball cannot teleport through a wall when its holder goes around it", () => {
  const { room, seat } = setup();
  seat.player.pos = { x: -18.5, y: 1.65, z: -8 };
  const ball = room.balls[0];
  ball.pos = { x: -18.5, y: 1, z: -8.7 };
  ball.body.setTranslation(ball.pos, true);
  room.action(seat.player.id, { kind: "pickup", id: 0 });
  assert.equal(ball.heldBy, seat.player.id);
  seat.player.pos = { x: -16, y: 1.65, z: -8 };
  room.tick();
  assert.ok(ball.pos.x < -17.2, `teleported to ${ball.pos.x}`);
  assert.equal(ball.heldBy, null);
  room.dispose();
});
test("moving basket blocks player at its actual lane", () => {
  const p = initialProgress();
  assert.equal(canOccupy(17, -1.3, p), false);
  p.basketLane = 0;
  assert.equal(canOccupy(14, -1.3, p), false);
  assert.equal(canOccupy(17, -1.3, p), true);
});
test("a free ball collides with the other player", () => {
  const { room, seat } = setup();
  seat.player.pos = { x: 0, y: 1.65, z: 0 };
  room.tick();
  const ball = room.balls[0];
  ball.body.setTranslation({ x: 0, y: 1, z: 2 }, true);
  ball.body.setLinvel({ x: 0, y: 0, z: -6 }, true);
  for (let i = 0; i < 15; i++) room.tick();
  assert.ok(ball.pos.z > 0, `ball crossed player at ${ball.pos.z}`);
  room.dispose();
});
test("three charged throws physically enter basket in a cooperative room", () => {
  const { room, seat } = setup();
  const other = room.join("B", "#91b9cf");
  other.player.pos = { x: 22, y: 1.65, z: 5 };
  room.action(other.player.id, { kind: "lever" });
  for (let hit = 0; hit < 3; hit++) {
    seat.player.pos = { x: 15, y: 1.65, z: 9.5 };
    room.action(seat.player.id, { kind: "pickup" });
    seat.player.pos = { x: 17, y: 1.65, z: 6 };
    seat.player.pitch = 0.3;
    room.action(seat.player.id, { kind: "charge" });
    for (let i = 0; i < 18; i++) room.tick();
    room.action(seat.player.id, {
      kind: "throw",
      direction: { x: 0, y: Math.sin(0.3), z: -Math.cos(0.3) },
    });
    for (let i = 0; i < 80; i++) room.tick();
    assert.equal(room.progress.throws, hit + 1);
  }
  assert.equal(room.progress.throwDone, true);
  room.dispose();
});
