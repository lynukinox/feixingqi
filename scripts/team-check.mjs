import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/index.js';
const server=createGameServer({turnMs:600000,cardRandom:()=>0}),addr=await server.listen(0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const pages=[],errors=[];
 for(let i=0;i<4;i++){const p=await browser.newPage({viewport:{width:390,height:844}});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${addr.port}`);}
 const a=pages[0];await a.locator('#new-game').click();await a.locator('#game-rules').selectOption('skills2v2');await expect(a.locator('#count')).toBeDisabled();await a.locator('input[value="local"]').check();await a.locator('#setup-form [type="submit"]').click();await expect(a.locator('#team-summary')).toContainText('红蓝队');
 for(let i=0;i<4;i++){await pages[i].locator('#online-open').click();await pages[i].locator('#online-name').fill(`组队${i}`);}
 await a.locator('#online-rules').selectOption('skills2v2');await a.locator('#room-create').click();await a.locator('#room-card').waitFor({state:'visible'});
 const room=[...server.rooms.values()][0];await expect(a.locator('#room-start')).toBeDisabled();
 for(let i=1;i<4;i++){await pages[i].locator('#room-code').fill(room.code);await pages[i].locator('#room-join').click();}
 await expect(a.locator('#room-start')).toBeEnabled();await a.locator('#room-start').click();
 for(const p of pages){await expect(p.locator('#mode-label')).toContainText('2v2');await expect(p.locator('#team-summary')).toContainText('黄绿队');}
 assert.deepEqual(room.state.players.map(p=>p.id),[0,1,2,3]);assert.equal(room.state.teamMode,true);
 room.state.players[2].pieces=[56,56,56,56];room.state.winner=2;room.state.phase='won';await a.reload();
 await expect(a.locator('#win-title')).toHaveText('红蓝队获胜！');await a.locator('#play-again').click();await a.locator('#room-start').click();
 await expect(a.locator('#room-lobby-dialog')).not.toBeVisible();assert.equal(room.state.teamMode,true);assert.equal(room.state.players.length,4);
 await pages[2].reload();await expect(pages[2].locator('#team-summary')).toContainText('红蓝队');assert.deepEqual(errors,[]);
 console.log('PASS: local 2v2 setup, four-phone room, diagonal teams, team victory, rematch and reconnect.');
}finally{await browser.close();await server.close();}
