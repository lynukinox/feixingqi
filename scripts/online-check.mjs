import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createGameServer} from '../server/index.js';

const server=createGameServer({rollDie:()=>6});const address=await server.listen(0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const a=await browser.newPage({viewport:{width:390,height:844}}),b=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${address.port}`;
  await a.goto(url);await a.locator('#online-open').click();await a.locator('#online-name').fill('小红');await a.locator('#room-create').click();await a.locator('#room-invite').waitFor();
  const code=await a.locator('.room-card h3 b').innerText();
  await a.locator('#room-invite').click();await a.locator('#invite-qr').waitFor();
  assert.match(await a.locator('#invite-link').inputValue(),new RegExp(`room=${code}`));
  await b.goto(`${url}/?room=${code}`);await b.locator('#online-name').fill('小蓝');await b.locator('#room-join').click();
  await a.waitForFunction(()=>!document.querySelector('#room-start').disabled);await a.locator('#room-start').click();
  await a.waitForFunction(()=>!document.querySelector('#roll').disabled);assert.equal(await b.locator('#roll').isDisabled(),true);
  await a.locator('#roll').click();await a.locator('[data-piece="0"]').waitFor();
  await b.waitForFunction(()=>document.querySelector('#dice').getAttribute('aria-label')==='骰子：6 点');
  assert.equal(await b.locator('#piece-actions button').count(),0);await a.locator('[data-piece="0"]').click();
  await b.waitForFunction(()=>document.querySelector('#log').textContent.includes('小红的 1 号飞机起飞啦'));
  await a.reload();await a.waitForFunction(()=>document.querySelector('#room-card')&&!document.querySelector('#room-card').hidden&&!document.querySelector('#roll').disabled);
  assert.equal(await a.locator('.room-card h3 b').innerText(),code);assert.equal(await a.locator('.room-members>div').count(),2);
  assert.match(await a.locator('#log').innerText(),/起飞啦/);
  await fs.mkdir('artifacts',{recursive:true});await a.screenshot({path:'artifacts/online-phone.png',fullPage:true});
  for(const p of [a,b])assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await a.locator('#room-leave').click();await a.locator('#room-leave').click();await b.waitForFunction(()=>document.querySelector('.room-members').textContent.includes('电脑接管'));
  assert.equal(await b.locator('#room-card').isVisible(),true);await b.locator('#room-leave').click();await b.locator('#room-leave').click();
  assert.deepEqual(errors,[]);console.log('Two-phone browser test passed: create, invite/QR, join, synchronized dice and moves, permissions, refresh/reconnect, leave, mobile layout.');
}finally{await browser.close();await server.close();}
