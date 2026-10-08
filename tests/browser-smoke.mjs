import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const a = await browser.newPage({ viewport: { width: 1200, height: 850 } });
const errors = [];
const base = process.env.GAME_URL || "http://localhost:3000";
a.on("pageerror", (e) => errors.push(e.message));
a.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
console.log("load lobby");
await a.goto(base);
await a.locator("#lobby-help").click();
await a.locator("#quality").selectOption("low");
await a.locator("#resume").click();
await a.waitForTimeout(2500);
await a.screenshot({ path: "artifacts/lobby.png" });
console.log("create room");
await a.locator("#name").fill("Лиса");
await a.locator("#create").click();
await a.locator("#overlay").waitFor({ state: "visible" });
const code = await a.evaluate(() => window.trail.snapshot.code);
console.log("joining second");
const b = await browser.newPage({ viewport: { width: 1280, height: 800 } });
b.on("pageerror", (e) => errors.push(e.message));
await b.goto(base + "/?room=" + code);
await b.locator("#lobby-help").click();
await b.locator("#quality").selectOption("low");
await b.locator("#resume").click();
await b.locator("#name").fill("Мох");
await b.locator(".swatch").nth(1).click();
await b.locator("#join-form button").click();
await b.locator("#overlay").waitFor({ state: "visible" });
await a.waitForFunction(
  () => window.trail.snapshot.players.filter((p) => p.online).length === 2,
);
console.log("pointer-lock rejection and recovery");
await a.evaluate(() => {
  const canvas = document.querySelector("#world");
  const original = canvas.requestPointerLock.bind(canvas);
  let rejectOnce = true;
  canvas.requestPointerLock = () => {
    if (rejectOnce) {
      rejectOnce = false;
      return Promise.reject(new Error("Test denial"));
    }
    return original();
  };
});
await a.locator("#resume").click();
await a.waitForFunction(
  () => window.trail.paused && document.querySelector("#overlay").hidden,
);
await a.locator("#world").click({ position: { x: 600, y: 400 } });
await a.waitForFunction(
  () => !window.trail.paused && document.pointerLockElement !== null,
);
console.log("moving");
await a.waitForTimeout(300);
await a.keyboard.down("KeyW");
await a.waitForTimeout(700);
await a.keyboard.up("KeyW");
const before = await a.evaluate(() => window.trail.position);
const view = await a.evaluate(() => ({
  yaw: window.trail.yaw,
  pitch: window.trail.pitch,
}));
await a.keyboard.press("Space");
await a.waitForTimeout(180);
const jump = await a.evaluate(() => window.trail.position);
await a.waitForTimeout(650);
await a.screenshot({ path: "artifacts/game.png" });
console.log(
  "movement result",
  before,
  jump,
  await a.evaluate(() => ({
    yaw: window.trail.yaw,
    pitch: window.trail.pitch,
    paused: window.trail.paused,
  })),
);
await a.keyboard.down("KeyQ");
await b.waitForTimeout(200);
const point = await b.evaluate(() =>
  window.trail.snapshot.players.some((p) => p.point),
);
await a.keyboard.up("KeyQ");
await a.keyboard.press("Escape");
await a.locator("#overlay").waitFor({ state: "visible" });
console.log("reloading");
await b.reload();
await b.locator("#join-form button").click();
await b.locator("#overlay").waitFor({ state: "visible" });
const resumed = await b.evaluate(() => window.trail.snapshot.players.length);
console.log(
  JSON.stringify(
    {
      code,
      before,
      jump,
      jumped: jump.y > before.y,
      point,
      resumed,
      view,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
if (
  errors.length ||
  jump.y <= before.y ||
  !point ||
  resumed !== 2 ||
  Math.abs(view.pitch) > 0.1 ||
  Math.abs(view.yaw) > 0.1 ||
  before.z >= 20
)
  process.exit(1);
