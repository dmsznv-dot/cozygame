import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
  });
  const errors = [],
    sockets = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.goto("http://127.0.0.1:4173/cozygame/");
  await page.waitForFunction(() => window.trail?.drawCalls > 0);
  assert.equal(await page.locator("#create").isDisabled(), false);
  assert.equal(await page.locator("#join-form button").isDisabled(), true);
  assert.notEqual(
    await page.locator("#create").evaluate((el) => getComputedStyle(el).cursor),
    "wait",
  );
  assert.match(
    await page.locator("#lobby-error").textContent(),
    /пройти лес одному/,
  );
  assert.equal(
    await page.locator("#brand a").getAttribute("href"),
    "/cozygame/",
  );
  await page.locator(".swatch").nth(1).click();
  await page.locator("#lobby-help").click();
  await page.locator("#quality").selectOption("low");
  await page.locator("#resume").click();
  console.log("Starting solo on static hosting");
  await page.locator("#create").click();
  await page.waitForFunction(
    () =>
      window.trail.mode === "solo" &&
      window.trail.snapshot?.players.length === 1,
  );
  assert.equal(await page.locator("#invite").isHidden(), true);
  assert.equal(await page.locator("#solo-help").isVisible(), true);
  await page.locator("#resume").click();
  await page.waitForFunction(() => !window.trail.paused);
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => window.trail.position.z < 19.8);
  await page.keyboard.up("KeyW");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.trail.position.y > 1.7);
  await page.waitForFunction(() => window.trail.position.y === 1.65);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/solo-pages.png" });
  await page.keyboard.press("Escape");
  await page.locator("#overlay").waitFor({ state: "visible" });
  assert.deepEqual(errors, []);
  assert.deepEqual(sockets, []);
  console.log(
    "PASS Pages solo: start, dynamic physics loading, movement, jump, pause, one player, no invite, zero asset/runtime errors and zero WebSocket connections",
  );
} finally {
  await browser.close();
}
