import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createGameServer} from '../server/index.js';

const server=createGameServer({rollDie:()=>1,cardRandom:()=>0}),address=await server.listen(0);
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try{
  await fs.mkdir('artifacts',{recursive:true});
  const ca=await browser.newContext({viewport:{width:390,height:844}}),cb=await browser.newContext({viewport:{width:390,height:844}});
  const a=await ca.newPage(),b=await cb.newPage();
  for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${address.port}`;
  await a.goto(url);await a.locator('#new-game').click();await a.locator('#game-rules').selectOption('skills');
  await a.locator('input[value="local"]').check();await a.locator('#setup-form button[type="submit"]').click();
  assert.equal(await a.locator('#skills-panel').isVisible(),true);assert.equal(await a.locator('.skill-card').count(),2);
  await a.locator('#new-game').click();await a.locator('#game-rules').selectOption('classic');await a.locator('#setup-form button[type="submit"]').click();
  assert.equal(await a.locator('#skills-panel').isVisible(),false);
  await a.locator('#online-open').click();await a.locator('#online-name').fill('甲');await a.locator('#online-rules').selectOption('skills');await a.locator('#room-create').click();
  await a.locator('#room-card').waitFor({state:'visible'});const r=[...server.rooms.values()][0];
  await b.goto(url);await b.locator('#online-open').click();await b.locator('#online-name').fill('乙');await b.locator('#room-code').fill(r.code);await b.locator('#room-join').click();
  await a.locator('#room-start').click();await a.locator('.skill-card').first().waitFor();
  async function card(index,value){
    await a.locator(`[data-card="${index}"]`).click();if(value!==undefined)await a.locator('#card-target').selectOption(String(value));
    await a.locator('#card-dialog button[type="submit"]').click();
    await a.waitForFunction(()=>document.querySelector('.skill-hint').textContent.includes('本次已出牌'));
  }
  await card(0,5);await a.locator('#roll').click();await a.locator('[data-piece="0"]').click();
  await a.waitForFunction(()=>!document.querySelector('#roll').disabled);
  assert.equal(r.state.players[0].pieces[0],0);assert.equal(r.state.current,0);
  assert.equal(await b.locator('.skill-card:not(:disabled)').count(),0);
  async function prepare(kind,setup=()=>{}){
    r.state.current=0;r.state.phase='roll';r.state.die=null;r.state.skillUsed=false;r.state.forcedDie=null;
    r.state.players[0].hand=[kind];setup();await a.reload();
    await a.locator('.skill-card:not(:disabled)').first().waitFor();
  }
  await prepare('barrier');await a.locator('[data-card="0"]').click();
  await a.locator('#barrier-map [data-option="5"]').click();assert.equal(await a.locator('#card-target').inputValue(),'5');
  await a.screenshot({path:'artifacts/skills-barrier-mobile.png',fullPage:true});
  await a.locator('#card-dialog button[type="submit"]').click();await a.waitForFunction(()=>document.querySelector('.skill-hint').textContent.includes('本次已出牌'));
  assert.equal(r.state.barriers.length,1);
  await prepare('shield');await a.locator('[data-card="0"]').click();await a.locator('#pick-on-board').click();
  await a.locator('#board-targets button').first().click();await a.locator('#card-dialog button[type="submit"]').click();
  await a.waitForFunction(()=>document.querySelector('.skill-hint').textContent.includes('本次已出牌'));assert.equal(r.state.players[0].shields[0],true);
  await prepare('missile',()=>{r.state.players[0].pieces[0]=1;r.state.players[0].pieces[1]=20;r.state.players[1].pieces[0]=27;});
  await a.locator('[data-card="0"]').click();
  assert.equal(await a.locator('#card-dialog button[type="submit"]').isDisabled(),true);
  await a.locator('#pick-on-board').click();
  await a.getByRole('button',{name:'选择自己的2号发射飞机',exact:true}).click();
  assert.match(await a.locator('#target-hint').innerText(),/没有敌机/);
  await a.getByRole('button',{name:'选择自己的1号发射飞机',exact:true}).click();
  assert.equal(await a.locator('.range-cell').count(),11);
  await a.screenshot({path:'artifacts/missile-targeting-mobile.png',fullPage:true});
  await a.getByRole('button',{name:'攻击乙 1号飞机',exact:true}).click();
  assert.match(await a.locator('#card-target').innerText(),/乙/);
  await a.locator('#card-dialog button[type="submit"]').click();
  await a.waitForFunction(()=>document.querySelector('.skill-hint').textContent.includes('本次已出牌'));
  assert.equal(r.state.players[1].pieces[0],-1);
  await prepare('disrupt',()=>{r.state.players[1].hand=['dice','shield'];});await card(0);assert.equal(r.state.players[1].hand.length,1);
  await prepare('steal');await card(0);assert.deepEqual(r.state.players[0].hand,['shield']);assert.equal(r.state.players[1].hand.length,0);
  await prepare('recycle');await card(0);assert.equal(r.state.players[0].pieces[0],-1);assert.equal(r.state.players[0].hand.length,2);
  await prepare('double',()=>{r.state.players[0].pieces=[-1,-1,-1,-1];});await card(0);assert.deepEqual(r.state.players[0].pieces.slice(0,2),[0,0]);
  await prepare('dice',()=>{r.state.players[0].hand=['dice','barrier','shield','missile','steal'];r.state.players[1].hand=['recycle'];});
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await a.screenshot({path:'artifacts/skills-mobile.png',fullPage:true});
  await a.setViewportSize({width:1440,height:1100});await a.screenshot({path:'artifacts/skills-desktop.png',fullPage:true});
  await prepare('dice',()=>{r.state.players[0].pieces=[55,56,56,56];});await card(0,0);
  await a.locator('#roll').click();await a.locator('[data-piece="0"]').click();
  await a.locator('#win-dialog').waitFor({state:'visible'});
  assert.equal(await a.locator('#match-results tbody tr').count(),2);
  assert.match(await a.locator('#match-results').innerText(),/4\/4/);
  await a.screenshot({path:'artifacts/match-results.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Skills browser check passed: classic/skills setup, two phones, all eight cards, roadblock map, forced six, reconnect, mobile layout; no page errors.');
}finally{await browser.close();await server.close();}
