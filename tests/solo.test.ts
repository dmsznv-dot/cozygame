import { test } from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Room } from "../server/rooms.ts";
import {
  STATIONS,
  SIGN_SEQUENCE,
  LIGHT_COUNTS,
  LIGHT_CODES,
  solved,
} from "../shared/game.ts";
await RAPIER.init();
test("solo signs require visiting the clue then can be completed at panel", () => {
  const room = new Room("SOLO", true),
    seat = room.join("Я", "#f3bf70");
  seat.player.pos = { ...STATIONS.signPanel, y: 1.65 };
  room.action(seat.player.id, { kind: "symbol", value: SIGN_SEQUENCE[0] });
  assert.equal(room.progress.signIndex, 0);
  seat.player.pos = { ...STATIONS.signPlate, y: 1.65 };
  room.tick();
  seat.player.pos = { ...STATIONS.signPanel, y: 1.65 };
  for (const value of SIGN_SEQUENCE)
    room.action(seat.player.id, { kind: "symbol", value });
  assert.equal(room.progress.signs, true);
  room.dispose();
});
test("solo full chapter: revisit lamps every round, fix basket, throw three real balls, unlock bridge", () => {
  const r = new Room("SOLO", true),
    a = r.join("Я", "#f3bf70");
  a.player.pos = { ...STATIONS.signPlate, y: 1.65 };
  r.tick();
  a.player.pos = { ...STATIONS.signPanel, y: 1.65 };
  for (const value of SIGN_SEQUENCE)
    r.action(a.player.id, { kind: "symbol", value });
  for (let round = 0; round < 3; round++) {
    a.player.pos = { ...STATIONS.lightPanel, y: 1.65 };
    r.action(a.player.id, {
      kind: "number",
      value: LIGHT_CODES[LIGHT_COUNTS[round]],
    });
    assert.equal(r.progress.lightRound, round);
    a.player.pos = { ...STATIONS.lightPlate, y: 1.65 };
    r.tick();
    a.player.pos = { ...STATIONS.lightPanel, y: 1.65 };
    r.action(a.player.id, {
      kind: "number",
      value: LIGHT_CODES[LIGHT_COUNTS[round]],
    });
    assert.equal(r.progress.lightRound, round + 1);
  }
  a.player.pos = { ...STATIONS.lever, y: 1.65 };
  r.action(a.player.id, { kind: "lever" });
  for (let i = 0; i < 3; i++) {
    a.player.pos = { ...STATIONS.rack, y: 1.65 };
    r.tick();
    assert.equal(r.progress.operator, a.player.id);
    r.action(a.player.id, { kind: "pickup" });
    a.player.pos = { x: 17, y: 1.65, z: 6 };
    r.action(a.player.id, {
      kind: "throw",
      direction: { x: 0, y: 0.08, z: -Math.sqrt(1 - 0.08 * 0.08) },
    });
    for (let j = 0; j < 50; j++) r.tick();
    assert.equal(r.progress.throws, i + 1);
  }
  assert.equal(solved(r.progress), true);
  assert.equal(r.seats.length, 1);
  r.dispose();
});
