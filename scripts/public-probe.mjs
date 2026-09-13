import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const url=process.argv[2];if(!url?.startsWith('https://'))throw Error('Pass the public HTTPS URL');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',error=>console.log('PAGE ERROR:',error.message));
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  console.log('HTTP',response.status(),'URL',page.url());
  await page.waitForTimeout(1500);
  console.log((await page.locator('body').innerText()).slice(0,2200));
  await fs.mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/public-probe.png',fullPage:true});
}finally{await browser.close();}
