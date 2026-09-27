import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/index.js';
const server=createGameServer({botDelayMs:10000}),addr=await server.listen(0),url=`http://127.0.0.1:${addr.port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});let a=await context.newPage();const b=await browser.newPage();
 for(const [p,name] of [[a,'甲'],[b,'乙']]){await p.goto(url);await p.locator('#online-open').click();await p.locator('#online-name').fill(name);}
 await a.locator('#room-create').click();await a.locator('#room-card').waitFor({state:'visible'});const r=[...server.rooms.values()][0],id=r.members[0].id;
 await b.locator('#room-code').fill(r.code);await b.locator('#room-join').click();await a.locator('#room-start').click();await expect(a.locator('#roll')).toBeEnabled();
 await a.close();a=await context.newPage();await a.goto(url);await a.locator('#room-card').waitFor({state:'visible'});
 await expect(a.locator('#roll')).toBeEnabled();assert.equal(r.members[0].id,id);assert.equal(r.members.length,2);
 await a.locator('#room-leave').click();await a.locator('#room-leave').click();await expect(a.locator('#room-card')).toBeHidden();assert.equal(r.members[0].bot,true);
 await a.locator('#online-open').click();await a.locator('#room-code').fill(r.code);await a.locator('#room-join').click();await a.locator('#room-card').waitFor({state:'visible'});
 await expect(a.locator('#roll')).toBeEnabled();assert.equal(r.members[0].bot,false);assert.equal(r.members[0].id,id);
 console.log('PASS: closing and reopening a phone tab restores the original seat; explicit leave and room-code rejoin reclaims the AI seat.');
}finally{await browser.close();await server.close();}
