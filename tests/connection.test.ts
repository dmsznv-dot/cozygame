import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameConnection } from '../src/connection.ts';
test('local server keeps same-origin WebSocket',()=>assert.equal(resolveGameConnection('',false,'http://localhost:3000/').url,'ws://localhost:3000/socket'));
test('Pages without backend explicitly disables joining',()=>assert.equal(resolveGameConnection('',true,'https://dmsznv-dot.github.io/cozygame/').url,null));
test('Pages connects to configured backend over TLS',()=>assert.equal(resolveGameConnection('https://game.example',true,'https://dmsznv-dot.github.io/cozygame/').url,'wss://game.example/socket'));
test('rejects insecure backend on HTTPS Pages',()=>assert.equal(resolveGameConnection('http://game.example',true,'https://dmsznv-dot.github.io/cozygame/').url,null));
test('invalid backend URL yields visible configuration error',()=>assert.ok(resolveGameConnection('not a url',true,'https://example.org/').reason));
