import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.argv[2];if(!base?.startsWith('https://'))throw Error('Pass the public HTTPS URL');
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try{
  const a=await browser.newPage({viewport:{width:390,height:844}}),b=await browser.newPage({viewport:{width:390,height:844}});
  for(const p of[a,b]){p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));}
  async function open(page,url){
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    const entry=page.getByRole('button',{name:'Enter site',exact:true});
    if(await entry.isVisible())await entry.click();
    else {const link=page.getByRole('link',{name:'Enter site',exact:true});if(await link.isVisible())await link.click();}
    await page.locator('#online-open').waitFor({timeout:60000});
  }
  await open(a,base);console.log('Public page and assets loaded.');
  const health=await a.request.get(`${base}/health`);assert.equal(health.status(),200);assert.deepEqual(await health.json(),{ok:true});
  await a.locator('#online-open').click();await a.locator('#online-name').fill('公网测试甲');await a.locator('#room-create').click();
  await a.locator('#room-invite').waitFor();const code=await a.locator('.room-card h3 b').innerText();
  console.log('Public WebSocket connected; room created:',code);
  await a.locator('#room-invite').click();const invite=await a.locator('#invite-link').inputValue();assert.equal(new URL(invite).searchParams.get('room'),code);assert.equal(new URL(invite).origin,new URL(base).origin);
  await a.locator('#invite-qr').waitFor();
  await open(b,invite);await b.locator('#online-name').fill('公网测试乙');await b.locator('#room-join').click();
  await a.waitForFunction(()=>!document.querySelector('#room-start').disabled);await a.locator('#room-start').click();
  await a.waitForFunction(()=>!document.querySelector('#roll').disabled);assert.equal(await b.locator('#roll').isDisabled(),true);
  console.log('Second independent mobile browser joined; host started; ownership verified.');
  let moved=false;
  // Use real server randomness; never change production dice or state for verification.
  for(let n=0;n<60&&!moved;n++){
    await a.waitForTimeout(250);
    let actor=null;
    for(const p of[a,b])if(await p.locator('#roll').isEnabled()){actor=p;break;}
    if(!actor){await a.waitForTimeout(500);continue;}
    const before=await actor.locator('#log').innerText();await actor.locator('#roll').click();
    await actor.waitForFunction(previous=>document.querySelector('#log').innerText!==previous,before);
    await actor.waitForTimeout(250);
    const die=await actor.locator('#dice').getAttribute('aria-label');
    const other=actor===a?b:a;await other.waitForFunction(expected=>document.querySelector('#dice').getAttribute('aria-label')===expected,die);
    console.log('Synchronized real dice:',die);
    if(await actor.locator('[data-piece="0"]').isVisible()){
      assert.equal(await other.locator('#piece-actions button').count(),0);
      await actor.locator('[data-piece="0"]').click();
      await other.waitForFunction(()=>document.querySelector('#log').textContent.includes('号飞机起飞啦'));
      await actor.waitForFunction(()=>document.querySelector('#log').textContent.includes('号飞机起飞啦'));
      assert.equal(await a.locator('#log').innerText(),await b.locator('#log').innerText());moved=true;
    }
  }
  assert.ok(moved,'Expected a legal launch from real dice within 60 attempts');
  await a.reload({waitUntil:'domcontentloaded'});await a.waitForFunction(()=>document.querySelector('#room-card')&&!document.querySelector('#room-card').hidden);
  assert.equal(await a.locator('.room-card h3 b').innerText(),code);assert.equal(await a.locator('.room-members>div').count(),2);
  assert.match(await a.locator('#log').innerText(),/号飞机起飞啦/);
  for(const p of[a,b])assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await fs.mkdir('artifacts',{recursive:true});await a.screenshot({path:'artifacts/public-phone.png',fullPage:true});
  await a.locator('#room-leave').click();await a.locator('#room-leave').click();await b.waitForFunction(()=>document.querySelector('#room-card').hidden);
  assert.deepEqual(errors,[]);console.log('PUBLIC PASS: HTTPS, assets, health, WebSocket, two-device invitation, real dice, legal move synchronization, seat permissions, refresh/reconnect, mobile layout, room exit.');
}catch(error){console.error(error);process.exitCode=1;}finally{await browser.close();}
