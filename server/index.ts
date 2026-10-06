import express from "express";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import RAPIER from "@dimforge/rapier3d-compat";
import { Room } from "./rooms.ts";
await RAPIER.init();
const app = express(),
  server = createServer(app);
const rooms = new Map<string, Room>();
const wss = new WebSocketServer({ server, path: "/socket", maxPayload: 4096 });
const connections = new Map<WebSocket, { room: Room; id: string }>();
const send = (ws: WebSocket, msg: unknown) => {
  if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256000)
    ws.send(JSON.stringify(msg));
};
app.get("/health", (_, res) => res.json({ ok: true, rooms: rooms.size }));
if (
  process.env.NODE_ENV === "production" ||
  process.argv.includes("--production")
)
  app.use(express.static("dist"));
else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
wss.on("connection", (ws) => {
  let count = 0;
  let window = Date.now();
  ws.on("message", (raw) => {
    try {
      if (Date.now() - window > 1000) {
        window = Date.now();
        count = 0;
      }
      if (++count > 80) return;
      const m = JSON.parse(String(raw));
      if (!m || typeof m !== "object") return;
      const c = connections.get(ws);
      if (m.type === "join" && !c) {
        let room: Room;
        const code = String(m.code || "").toUpperCase();
        if (code) {
          const found = rooms.get(code);
          if (!found)
            throw Error(
              "Комната не найдена. Проверьте код или создайте новую прогулку.",
            );
          room = found;
        } else {
          if (rooms.size >= 200)
            throw Error("Сервер занят. Попробуйте чуть позже.");
          let newCode;
          do {
            newCode = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
          } while (rooms.has(newCode));
          room = new Room(newCode);
          rooms.set(newCode, room);
        }
        const seat = room.join(m.name, m.color, m.token);
        for (const [old, other] of connections)
          if (other.room === room && other.id === seat.player.id) {
            connections.delete(old);
            old.close(4001, "Reconnected elsewhere");
          }
        connections.set(ws, { room, id: seat.player.id });
        send(ws, {
          type: "welcome",
          id: seat.player.id,
          token: seat.token,
          snapshot: room.snapshot(),
        });
      } else if (c && m.type === "move") {
        if (!c.room.move(c.id, m)) {
          const player = c.room.seats.find((s) => s.player.id === c.id)!.player;
          send(ws, { type: "correction", pos: player.pos });
        }
      } else if (c && m.type === "action") c.room.action(c.id, m.action);
    } catch (e) {
      send(ws, {
        type: "error",
        message: e instanceof Error ? e.message : "Некорректное сообщение",
      });
    }
  });
  ws.on("close", () => {
    const c = connections.get(ws);
    if (c) c.room.disconnect(c.id);
    connections.delete(ws);
  });
  ws.on("error", () => {});
});
setInterval(() => {
  for (const [code, r] of rooms) {
    if (
      !r.seats.some((s) => s.player.online) &&
      Date.now() - r.lastActive > 30 * 60 * 1000
    ) {
      r.dispose();
      rooms.delete(code);
    } else if (r.seats.some((s) => s.player.online)) r.tick();
  }
  for (const [ws, c] of connections)
    send(ws, { type: "state", snapshot: c.room.snapshot() });
}, 1000 / 30);
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () =>
  console.log(`Quiet Trail http://localhost:${port}`),
);
