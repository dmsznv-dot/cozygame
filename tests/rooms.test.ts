import { test } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../server/rooms.ts";
import {
  STATIONS,
  SIGN_SEQUENCE,
  LIGHT_COUNTS,
  LIGHT_CODES,
  SPAWN,
} from "../shared/game.ts";
import RAPIER from "@dimforge/rapier3d-compat";
await RAPIER.init();
const setup = () => {
  const r = new Room("ABCDEF");
  const a = r.join("Лиса", "#f3bf70");
  const b = r.join("Мох", "#a6c7a1");
  return { r, a, b };
};
test("two seats, invalid recovery rejected and own seat resumes", () => {
  const { r, a } = setup();
  assert.throws(() => r.join("third", "#fff"));
  r.disconnect(a.player.id);
  assert.throws(() => r.join("third", "#fff", "wrong"));
  assert.equal(r.join("Лиса", "#f3bf70", a.token).player.id, a.player.id);
  r.dispose();
});
test("symbols need a distinct observer and reset on error", () => {
  const { r, a, b } = setup();
  a.player.pos = { ...STATIONS.signPanel, y: 1.65 };
  r.action(a.player.id, { kind: "symbol", value: 1 });
  assert.equal(r.progress.signIndex, 0);
  b.player.pos = { ...STATIONS.signPlate, y: 1.65 };
  r.action(a.player.id, { kind: "symbol", value: 0 });
  assert.equal(r.progress.signIndex, 0);
  for (const value of SIGN_SEQUENCE)
    r.action(a.player.id, { kind: "symbol", value });
  assert.equal(r.progress.signs, true);
  r.dispose();
});
test("lamps require cooperation, three rounds and preserve other rooms", () => {
  const { r, a, b } = setup();
  const other = new Room("OTHER");
  a.player.pos = { ...STATIONS.lightPanel, y: 1.65 };
  b.player.pos = { ...STATIONS.lightPlate, y: 1.65 };
  for (const n of LIGHT_COUNTS)
    r.action(a.player.id, { kind: "number", value: LIGHT_CODES[n] });
  assert.equal(r.progress.lights, true);
  assert.equal(other.progress.lights, false);
  r.dispose();
  other.dispose();
});
test("movement rejects NaN, teleport, wall crossing; disconnect releases roles", () => {
  const { r, a } = setup();
  r.move(a.player.id, { pos: { x: NaN, y: 0, z: 0 }, yaw: 0, pitch: 0 });
  assert.deepEqual(a.player.pos, SPAWN);
  r.move(a.player.id, { pos: { x: 50, y: 0, z: 0 }, yaw: 0, pitch: 0 });
  assert.deepEqual(a.player.pos, SPAWN);
  a.player.pos = { ...STATIONS.lever, y: 1.65 };
  r.action(a.player.id, { kind: "lever" });
  assert.equal(r.progress.operator, a.player.id);
  r.disconnect(a.player.id);
  assert.equal(r.progress.operator, null);
  r.dispose();
});
test("ball pickup is exclusive and capture requires another operator", () => {
  const { r, a, b } = setup();
  a.player.pos = { ...STATIONS.rack, y: 1.65 };
  b.player.pos = { ...STATIONS.rack, y: 1.65 };
  r.action(a.player.id, { kind: "pickup" });
  r.action(b.player.id, { kind: "pickup" });
  assert.notEqual(
    r.balls.find((x) => x.heldBy === a.player.id)?.id,
    r.balls.find((x) => x.heldBy === b.player.id)?.id,
  );
  r.action(a.player.id, { kind: "throw", direction: { x: 0, y: 0.2, z: -1 } });
  assert.equal(
    r.balls.some((x) => x.heldBy === a.player.id),
    false,
  );
  r.dispose();
});
test("actual Rapier trajectory lands in basket, needs operator, and unlocks after three", () => {
  const { r, a, b } = setup();
  b.player.pos = { ...STATIONS.lever, y: 1.65 };
  r.action(b.player.id, { kind: "lever" });
  for (let i = 0; i < 3; i++) {
    a.player.pos = { ...STATIONS.rack, y: 1.65 };
    r.action(a.player.id, { kind: "pickup" });
    a.player.pos = { x: 17, y: 1.65, z: 6 };
    r.action(a.player.id, {
      kind: "throw",
      direction: { x: 0, y: 0.14, z: -Math.sqrt(1 - 0.14 * 0.14) },
    });
    for (let j = 0; j < 50; j++) r.tick();
    assert.equal(r.progress.throws, i + 1);
  }
  assert.equal(r.progress.throwDone, true);
  r.dispose();
});
test("a lone throw cannot solve the basket", () => {
  const { r, a } = setup();
  a.player.pos = { ...STATIONS.rack, y: 1.65 };
  r.action(a.player.id, { kind: "pickup" });
  a.player.pos = { x: 17, y: 1.65, z: 6 };
  r.action(a.player.id, {
    kind: "throw",
    direction: { x: 0, y: 0.14, z: -Math.sqrt(1 - 0.14 * 0.14) },
  });
  for (let i = 0; i < 50; i++) r.tick();
  assert.equal(r.progress.throws, 0);
  r.dispose();
});
test("legal axis-separated turn around cabin corner stays synchronized", () => {
  const { r, a } = setup();
  a.player.pos = { x: -16.55, y: 1.65, z: -12.86 };
  const end = { x: -16.39, y: 1.65, z: -12.7 };
  r.move(a.player.id, { pos: end, yaw: 0, pitch: 0 });
  assert.deepEqual(a.player.pos, end);
  r.dispose();
});
test('swept movement cannot cross a thin cabin wall',()=>{const {r,a}=setup();a.player.pos={x:-16.3,y:1.65,z:-8};a.lastMove=Date.now()-200;const accepted=r.move(a.player.id,{pos:{x:-17.7,y:1.65,z:-8},yaw:0,pitch:0});assert.equal(accepted,false);assert.equal(a.player.pos.x,-16.3);r.dispose();});
