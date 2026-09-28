import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createGameServer} from '../server/index.js';
const server=createGameServer({turnMs:600000}),addr=await server.listen(0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 await mkdir('artifacts',{recursive:true});
 const a=await browser.newPage({viewport:{width:1440,height:1100}}),b=await browser.newPage();const errors=[];
 a.on('pageerror',e=>errors.push(e.message));
 for(const p of [a,b]){await p.goto(`http://127.0.0.1:${addr.port}`);await p.locator('#online-open').click();}
 await a.locator('#online-rules').selectOption('skills');await a.locator('#room-create').click();await a.locator('#room-card').waitFor({state:'visible'});
 const room=[...server.rooms.values()][0];await b.locator('#room-code').fill(room.code);await b.locator('#room-join').click();await a.locator('#room-start').click();await expect(a.locator('#roll')).toBeEnabled();
 room.state.players[0].pieces=[12,20,0,-1];room.state.players[1].pieces[0]=1;
 const sets=[['dice','barrier','missile','shield','disrupt'],['recycle','double','triple','retreat','steal']];
 for(let i=0;i<sets.length;i++){
  room.state.players[0].hand=sets[i];await a.reload();await expect(a.locator('.skill-card')).toHaveCount(5);
  await expect(a.locator('.skill-card svg')).toHaveCount(5);
  await a.locator('#skills-panel').screenshot({path:`artifacts/cards-desktop-${i}.png`});
 }
 await a.setViewportSize({width:390,height:844});await a.locator('#skills-panel').scrollIntoViewIfNeeded();
 await a.locator('#skills-panel').screenshot({path:'artifacts/cards-mobile.png'});
 assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await a.locator('[data-card="2"]').click();await expect(a.locator('#card-dialog')).toBeVisible();
 await expect(a.locator('#card-dialog h2')).toHaveText('强行顶');await a.locator('#card-dialog').screenshot({path:'artifacts/card-dialog.png'});
 await a.locator('#card-dialog [type=submit]').click();await expect(a.locator('.skill-card')).toHaveCount(4);assert.equal(room.state.players[0].triple,1);
 room.state.players[0].hand=sets[0];room.state.players[0].pendingCards=['triple'];await a.reload();
 await expect(a.locator('[data-discard] svg')).toHaveCount(6);await a.locator('[data-discard="5"]').click();await expect(a.locator('[data-discard]')).toHaveCount(0);
 assert.deepEqual(errors,[]);console.log('PASS: ten card faces, desktop/mobile layout, card confirmation and overflow discard.');
}finally{await browser.close();await server.close();}
