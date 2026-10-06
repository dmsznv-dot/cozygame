import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
// Run after VITE_STATIC_HOST=true npm run build -- --base=/cozygame/
// and npx vite preview --host 127.0.0.1 --port 4173 --base=/cozygame/.
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}});
 const errors=[];const sockets=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 page.on('websocket',socket=>sockets.push(socket.url()));
 await page.goto('http://127.0.0.1:4173/cozygame/');
 await page.waitForFunction(()=>window.trail?.drawCalls>0);
 assert.equal(await page.locator('#create').isDisabled(),true);
 assert.equal(await page.locator('#join-form button').isDisabled(),true);
 assert.match(await page.locator('#lobby-error').textContent(),/сервер ещё не подключён/);
 assert.equal(await page.locator('#brand a').getAttribute('href'),'/cozygame/');
 await page.locator('.swatch').nth(1).click();
 assert.equal(await page.locator('.swatch').nth(1).getAttribute('aria-pressed'),'true');
 await mkdir('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/pages.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);
 console.log('PASS Pages subpath: scene, fonts, color, home link, missing-server notice; zero asset/runtime errors and no unsupported WebSocket attempts');
} finally {await browser.close();}
