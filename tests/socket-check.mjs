import WebSocket from "ws";
import assert from "node:assert/strict";
const sockets = [];
function client() {
  const ws = new WebSocket(
    process.env.SOCKET_URL || "ws://localhost:3000/socket",
  );
  sockets.push(ws);
  const inbox = [];
  ws.on("message", (raw) => inbox.push(JSON.parse(String(raw))));
  return {
    ws,
    async wait(type) {
      const until = Date.now() + 5000;
      while (Date.now() < until) {
        const i = inbox.findIndex((x) => x.type === type);
        if (i >= 0) return inbox.splice(i, 1)[0];
        await new Promise((r) => setTimeout(r, 20));
      }
      throw Error("Timed out waiting " + type);
    },
    async join(data) {
      if (ws.readyState === WebSocket.CONNECTING)
        await new Promise((r) => ws.once("open", r));
      ws.send(
        JSON.stringify({
          type: "join",
          name: "Тест",
          color: "#f3bf70",
          ...data,
        }),
      );
    },
  };
}
try {
  const a = client();
  await a.join({});
  const first = await a.wait("welcome");
  const code = first.snapshot.code;
  const b = client();
  await b.join({ code });
  await b.wait("welcome");
  const c = client();
  await c.join({ code });
  assert.match((await c.wait("error")).message, /двое/);
  a.ws.send("{");
  assert.ok(await a.wait("error"));
  a.ws.send(
    JSON.stringify({
      type: "move",
      pos: { x: 0, y: 1.65, z: 19.8 },
      yaw: 0,
      pitch: 0,
    }),
  );
  let state;
  for (let i = 0; i < 6; i++) {
    state = (await b.wait("state")).snapshot;
    if (state.players.find((p) => p.id === first.id).pos.z === 19.8) break;
  }
  assert.equal(state.players.find((p) => p.id === first.id).pos.z, 19.8);
  a.ws.send(
    JSON.stringify({
      type: "move",
      pos: { x: 50, y: 1.65, z: 40 },
      yaw: 0,
      pitch: 0,
    }),
  );
  const correction = await a.wait("correction");
  assert.equal(correction.pos.z, 19.8);
  const other = client();
  await other.join({});
  const otherWelcome = await other.wait("welcome");
  assert.notEqual(otherWelcome.snapshot.code, code);
  assert.equal(otherWelcome.snapshot.players.length, 1);
  a.ws.close();
  await new Promise((r) => setTimeout(r, 100));
  const resume = client();
  await resume.join({ code, token: first.token });
  const resumed = await resume.wait("welcome");
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.snapshot.players.length, 2);
  assert.equal(
    resumed.snapshot.players.find((p) => p.id === first.id).pos.z,
    19.8,
  );
  console.log(
    "PASS WebSocket: two clients, room capacity, malformed JSON, movement sync, authoritative correction, isolation, recovery",
  );
} finally {
  for (const s of sockets) s.close();
}
