import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/index.js';
import {drawCards} from '../src/engine.js';
const server=createGameServer({cardRandom:()=>0}),addr=await server.listen(0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const a=await browser.newPage({viewport:{width:390,height:844}}),b=await browser.newPage();
 const errors=[];a.on('pageerror',e=>errors.push(e.message));
 for(const [page,name] of [[a,'甲'],[b,'乙']]){await page.goto(`http://127.0.0.1:${addr.port}`);await page.locator('#online-open').click();await page.locator('#online-name').fill(name);}
 await a.locator('#online-rules').selectOption('skills');await a.locator('#room-create').click();await a.locator('#room-card').waitFor({state:'visible'});
 const r=[...server.rooms.values()][0];await b.locator('#room-code').fill(r.code);await b.locator('#room-join').click();await a.locator('#room-start').click();await a.locator('[data-card]').first().waitFor();
 r.state.players[0].hand=Array(5).fill('dice');drawCards(r.state,r.state.players[0],2,()=>3);
 await a.reload();await a.locator('[data-discard="5"]').waitFor();assert.equal(await a.locator('#roll').isDisabled(),true);
 await a.locator('[data-discard="0"]').click();await a.waitForFunction(()=>document.querySelector('.skill-hint').textContent.includes('还有 1 张'));
 assert.equal(r.state.players[0].hand.at(-1),'shield');
 await a.screenshot({path:'artifacts/discard-mobile.png',fullPage:true});
 await a.reload();await a.locator('[data-discard="5"]').click();await a.locator('[data-card]').first().waitFor();
 assert.equal(r.state.players[0].pendingCards.length,0);assert.equal(await a.locator('#roll').isEnabled(),true);
 await a.getByRole('button',{name:'主动弃牌',exact:true}).click();await a.locator('[data-card="0"]').click();
 await a.waitForFunction(()=>document.querySelectorAll('[data-card]').length===4);
 assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('Discard mobile UI: swap, reject, reload recovery, voluntary discard and five-card cap passed.');
}finally{await browser.close();await server.close();}
