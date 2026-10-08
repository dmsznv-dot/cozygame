import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 480 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4174/");
  await page.locator("#lobby-help").click();
  await page.locator("#quality").selectOption("low");
  await page.locator("#resume").click();
  await page.locator("#solo").click();
  await page.waitForFunction(() => window.trail?.mode === "solo");
  await page.locator("#resume").click();
  async function walk(key, axis, end, greater) {
    console.log("walk", key, axis, end);
    await page.keyboard.down(key);
    await page.waitForFunction(
      ({ axis, end, greater }) =>
        greater ? trail.position[axis] >= end : trail.position[axis] <= end,
      { axis, end, greater },
      { timeout: 60000 },
    );
    await page.keyboard.up(key);
    console.log("position", await page.evaluate(() => trail.position));
  }
  await walk("KeyW", "z", 10.1, false);
  await walk("KeyD", "x", 14.8, true);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() =>
    trail.snapshot.balls.some((b) => b.heldBy === trail.myId),
  );
  assert.equal(await page.evaluate(() => trail.bodyVisible), true);
  assert.equal(await page.locator("#context-panel").isHidden(), true);
  assert.equal(await page.locator("#prompt").textContent(), "");
  console.log("charging");
  await page.mouse.down();
  await page.waitForFunction(() => trail.snapshot.players[0].charge > 0.25);
  assert.equal(await page.evaluate(() => trail.charging), true);
  await page.mouse.up();
  await page.waitForFunction(
    () => !trail.snapshot.balls.some((b) => b.heldBy === trail.myId),
  );
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() =>
    trail.snapshot.balls.some((b) => b.heldBy === trail.myId),
  );
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () => !trail.snapshot.balls.some((b) => b.heldBy === trail.myId),
  );
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() =>
    trail.snapshot.balls.some((b) => b.heldBy === trail.myId),
  );
  await page.mouse.down();
  await page.waitForFunction(() => trail.charging);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(await page.evaluate(() => trail.charging), false);
  assert.ok(
    await page.evaluate(() =>
      trail.snapshot.balls.some((b) => b.heldBy === trail.myId),
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS actual browser input: walk to rack, pickup, held charge, release, gentle drop, cancel on pause, visible body, no puzzle tips",
  );
} finally {
  await browser.close();
}
