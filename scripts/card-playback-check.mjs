import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createGameServer} from '../server/index.js';
const server=createGameServer({turnMs:600000}),addr=await server.listen(0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const a=await browser.newPage({viewport:{width:390,height:844}}),b=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${addr.port}`);await p.locator('#online-open').click();}
 await a.locator('#online-rules').selectOption('skills');await a.locator('#room-create').click();await a.locator('#room-card').waitFor({state:'visible'});
 const room=[...server.rooms.values()][0];await b.locator('#room-code').fill(room.code);await b.locator('#room-join').click();await a.locator('#room-start').click();await expect(a.locator('#roll')).toBeEnabled();
 room.state.players[0].hand=['triple','cruise'];await a.reload();await expect(a.locator('.skill-card')).toHaveCount(2);
 await a.locator('[data-card="0"]').click();await a.locator('#card-dialog [type=submit]').click();
 for(const p of [a,b]){await expect(p.locator('.airport-card strong')).toHaveText('强行顶');await expect(p.locator('.airport-card')).toHaveAttribute('data-player','0');}
 await a.locator('[data-card="0"]').click();await a.locator('#card-dialog [type=submit]').click();
 for(const p of [a,b])await expect(p.locator('.airport-card strong')).toHaveText('双倍巡航');
 await mkdir('artifacts',{recursive:true});await b.locator('#board').screenshot({path:'artifacts/card-playback-mobile.png'});
 assert.equal(await b.locator('#card-playback').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 for(const p of [a,b])await expect(p.locator('.airport-card')).toHaveCount(0);
 await b.reload();await expect(b.locator('#room-card')).toBeVisible();await expect(b.locator('.airport-card')).toHaveCount(0);
 assert.deepEqual(errors,[]);console.log('PASS: both phones show caster-airport cards in order, expire, do not intercept input or replay on reconnect.');
}finally{await browser.close();await server.close();}
