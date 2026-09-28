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
 r.state.players[0].pieces=[56,56,56,56];r.state.winner=0;r.state.phase='won';
 await a.reload();await expect(a.locator('#win-dialog')).toBeVisible();await a.locator('#play-again').click();
 await expect(a.locator('#room-lobby-dialog')).toBeVisible();
 await expect(b.locator('#win-dialog')).toBeVisible();await b.locator('#play-again').click();
 await expect(b.locator('#room-lobby-dialog')).toBeVisible();await expect(b.locator('.room-hint')).toContainText('等待房主');
 await expect(a.locator('#win-dialog')).not.toBeVisible();
 const firstMatch=r.state.matchId;await a.locator('#room-start').click();
 await expect(a.locator('#room-lobby-dialog')).not.toBeVisible();await expect(b.locator('#room-lobby-dialog')).not.toBeVisible();
 await expect(a.locator('#roll')).toBeEnabled();assert.notEqual(r.state.matchId,firstMatch);
 assert.equal(r.members.length,2);assert.equal(r.members[0].id,id);
 r.state.players[0].pieces=[56,56,56,56];r.state.winner=0;r.state.phase='won';
 await a.reload();await expect(a.locator('#win-dialog')).toBeVisible();
 console.log('PASS: both players return to the room, host starts a rematch with the same seats, and the next match has its own settlement.');
}finally{await browser.close();await server.close();}

