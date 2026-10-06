import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Build with VITE_STATIC_HOST=true VITE_GAME_SERVER_URL=http://127.0.0.1:3010,
// serve with Vite preview on 4173 and the room server on 3010.
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:750}});
 await page.addInitScript(()=>{
  window.testSockets=[];
  const Original=window.WebSocket;
  window.WebSocket=class extends Original {constructor(...args){super(...args);window.testSockets.push(this);}};
 });
 await page.goto('http://127.0.0.1:4173/cozygame/');
 await page.locator('#lobby-help').click();await page.locator('#quality').selectOption('low');await page.locator('#resume').click();
 await page.locator('#room-code').fill('ABCDEF');await page.locator('#join-form button').click();
 await page.waitForFunction(()=>document.querySelector('#lobby-error').textContent.includes('Комната не найдена'));
 assert.equal(await page.evaluate(()=>window.testSockets[0].readyState),1);
 await page.locator('#solo').click();await page.waitForFunction(()=>window.trail.mode==='solo');
 await page.waitForFunction(()=>window.testSockets[0].readyState===3);
 assert.equal(await page.evaluate(()=>window.testSockets[0].onclose),null);
 await page.evaluate(()=>window.testSockets[0].dispatchEvent(new CloseEvent('close')));
 await page.locator('#resume').click();await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.trail.position.z<19.8);await page.keyboard.up('KeyW');
 assert.equal(await page.evaluate(()=>window.trail.mode),'solo');
 assert.equal(await page.evaluate(()=>window.testSockets.length),1);
 console.log('PASS failed network join -> solo closes old socket, ignores late disconnect, movement continues without reconnect');
}finally{await browser.close();}
