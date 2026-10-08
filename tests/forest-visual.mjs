import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    }),
    errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGE ERROR", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(m.text());
      console.log("CONSOLE ERROR", m.text());
    }
  });
  await page.goto("http://127.0.0.1:4174/tests/scene.html");
  await page.waitForFunction(() => window.sceneQA?.world.selfAvatar.visible);
  for (const [name, pos, yaw, pitch] of [
    ["forest", { x: 0, y: 1.65, z: 20 }, 0, 0],
    ["body", { x: 0, y: 1.65, z: 20 }, 0, -1.25],
    ["symbols", { x: -20, y: 1.65, z: -8 }, 0, 0.06],
    ["table", { x: 2, y: 1.65, z: -21.5 }, 0, 0.04],
    ["river", { x: 0, y: 1.65, z: -33 }, 0.65, 0.03],
    ["ruins", { x: -31, y: 1.65, z: 23 }, 0, 0.05],
  ]) {
    await page.evaluate(
      ({ pos, yaw, pitch }) => sceneQA.pose(pos, yaw, pitch),
      { pos, yaw, pitch },
    );
    await page.waitForTimeout(900);
    await page.screenshot({ path: `artifacts/polish-${name}.png` });
    console.log("captured", name);
  }
  await page.evaluate(() => sceneQA.pose({ x: 15, y: 1.65, z: 9.5 }));
  await page.waitForFunction(
    () => sceneQA.solo.snapshot().players[0].pos.x === 15,
  );
  await page.evaluate(() => sceneQA.action({ kind: "pickup" }));
  await page.waitForFunction(() =>
    sceneQA.solo.snapshot().balls.some((b) => b.heldBy),
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/polish-holding.png" });
  await page.evaluate(() => sceneQA.action({ kind: "charge" }));
  await page.waitForFunction(
    () => sceneQA.solo.snapshot().players[0].charge > 0.8,
  );
  await page.screenshot({ path: "artifacts/polish-charge.png" });
  const panels = await page.evaluate(() =>
    sceneQA.world.signTiles.map((m) => {
      const p = m.children[0];
      return {
        w: p.geometry.parameters.width,
        h: p.geometry.parameters.height,
        tw: p.material.map.image.width,
        th: p.material.map.image.height,
      };
    }),
  );
  for (const p of panels) assert.ok(Math.abs(p.w / p.h - p.tw / p.th) < 0.01);
  assert.deepEqual(errors, []);
  console.log(
    "PASS high-quality renderer: body, holding, charge, puzzle panel proportions, zero shader/runtime errors",
  );
} finally {
  await browser.close();
}
