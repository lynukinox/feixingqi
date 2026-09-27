import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/index.js';
const server=createGameServer({rollDie:()=>6}),addr=await server.listen(0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const a=await browser.newPage({viewport:{width:390,height:844}}),b=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 for(const [p,name] of [[a,'动画甲'],[b,'动画乙']]){p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${addr.port}`);await p.locator('#online-open').click();await p.locator('#online-name').fill(name);}
 await a.locator('#room-create').click();await a.locator('#room-card').waitFor({state:'visible'});
 const r=[...server.rooms.values()][0];await b.locator('#room-code').fill(r.code);await b.locator('#room-join').click();await a.locator('#room-start').click();await expect(a.locator('#roll')).toBeEnabled();
 r.state.players[0].pieces[0]=3;await a.reload();await expect(a.locator('#roll')).toBeEnabled();
 await a.locator('#roll').click();await a.locator('[data-piece="0"]').click();
 await expect(a.locator('#status')).toHaveText('飞机正在航线上飞行');await expect(b.locator('#status')).toHaveText('飞机正在航线上飞行');
 await expect(a.locator('#roll')).toBeDisabled();
 const first=await b.locator('#board canvas').screenshot();await b.waitForTimeout(180);const second=await b.locator('#board canvas').screenshot();
 assert.notDeepEqual(first,second,'Board should move through intermediate frames');
 await expect(a.locator('#roll')).toBeEnabled();await expect(b.locator('#status')).not.toHaveText('飞机正在航线上飞行');
 assert.equal(r.state.players[0].pieces[0],9);assert.deepEqual(errors,[]);
 console.log('PASS: both phone clients animate intermediate movement frames, lock actions during motion, and finish at the authoritative position.');
}finally{await browser.close();await server.close();}
