import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { auditColors } from './color-audit.mjs';
const browser = await chromium.launch({headless:true});
const base = process.env.PICO_TEST_URL || 'http://127.0.0.1:5174/pico/';
const budget = {title:'July spending',metrics:[{label:'Spent',value:'€650'},{label:'Categories',value:'2'}],items:[{name:'Rent',value:'450',detail:'Housing'},{name:'Food',value:'200',detail:'Groceries'}],labels:['Category','EUR'],description:''};
const tasks = {...budget,title:'Weekend launch',items:[{name:'Write the copy',value:'Content',detail:'Start with the main idea.'},{name:'Publish',value:'Release',detail:'Check the public page.'}]};
const gallery = {...budget,title:'Listening after hours',items:[{name:'Late rotation',value:'Listening',detail:'A selection for the end of the night.',image:'vinyl'},{name:'Tomorrow, slowly',value:'Sunday',detail:'An unhurried selection.'},{name:'Night transport',value:'After midnight',detail:'A longer route home.'}]};
try {
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({budget,tasks})=>{
  const original=fetch.bind(window);let request=0;
  window.fetch=async(url,init)=>{
   if(!String(url).endsWith('/pico/api/generate'))return original(url,init);
   const count=request++;
   return new Response(new ReadableStream({async start(c){
    const send=e=>c.enqueue(new TextEncoder().encode(JSON.stringify(e)+'\n'));
    const gate=()=>new Promise(resolve=>{window.__advance=resolve});
    send({type:'plan',plan:{view:count===0?'dashboard':'checklist',accent:'blue',visual:count===0?'bars':'none',model:'explicit-stream-fixture',decisionMs:100,confidence:.9}});
    if(count===0){
     send({type:'delta',text:'{"title":"July spending","metrics":[{"label":"Spent","value":"€650"}'}); await gate();
     send({type:'delta',text:',{"label":"Categories","value":"2"}],"items":[{"name":"Rent","value":"450","detail":"Housing"},'});await gate();
    }else{
     send({type:'delta',text:'{"title":"Weekend launch","items":[{"name":"Write the copy","value":"Content","detail":"Start with the main idea."},'});await gate();
    }
    send({type:'complete',content:count===0?budget:tasks,generationModel:'explicit-stream-fixture',totalMs:900});c.close();
   }}));
  };
 },{budget,tasks});
 await page.goto(base);
 // Native share receives the app URL only, even when a preview exists.
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shared=data}}));
 await page.getByRole('button',{name:'Share Pico',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.__shared),{title:'Pico',url:'https://keff.uk/pico/'});
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}});});
 await page.getByRole('button',{name:'Share Pico',exact:true}).click();
 await page.getByText('Link copied',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__copied),'https://keff.uk/pico/');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));
 await page.getByRole('button',{name:'Share Pico',exact:true}).click();
 await page.getByRole('heading',{name:'Share Pico',exact:true}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'App link',exact:true}).inputValue(),'https://keff.uk/pico/');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'About Pico',exact:true}).click();
 assert.equal(await page.locator('.technical-details').getAttribute('open'),null);
 assert.equal(await page.getByText('gpt-6-luna · Decisions',{exact:true}).isVisible(),false);
 await page.screenshot({path:'output/playwright/experiment-about-mobile.png'});
 await page.keyboard.press('Escape');
 const generate=async text=>{await page.locator('#prompt').fill(text);await page.getByRole('button',{name:'Generate interface',exact:true}).click()};
 const advance=()=>page.evaluate(()=>window.__advance());
 await generate('A budget');
 await page.getByText('€650',{exact:true}).waitFor();
 assert.equal(await page.locator('.data-bar').count(),0,'Metrics must appear before items.');
 const titleY=(await page.getByRole('heading',{name:'July spending',exact:true}).boundingBox()).y;
 await page.screenshot({path:'output/playwright/stream-metrics-first.png'});
 await advance();await page.locator('.data-bar').first().waitFor();
 assert.equal(await page.locator('.data-bar').count(),1);
 assert.equal((await page.getByRole('heading',{name:'July spending',exact:true}).boundingBox()).y,titleY,'The title must stay in place as content fills.');
 await advance();await page.getByText('Ready to try',{exact:true}).waitFor();
 await generate('A checklist');
 const first=page.getByRole('checkbox',{name:'Complete Write the copy'});await first.check();
 assert.equal(await page.getByRole('button',{name:'Stop generation'}).isVisible(),true);
 await advance();await page.getByText('Ready to try',{exact:true}).waitFor();assert.equal(await first.isChecked(),true);
 await page.close();
 const visuals=[];
 for(const size of [{width:1280,height:800},{width:390,height:844},{width:320,height:568}]){
  const context=await browser.newContext({viewport:size,reducedMotion:'reduce'});const p=await context.newPage();
  await p.route('**/pico/api/generate',r=>r.fulfill({contentType:'application/x-ndjson',body:[{type:'plan',plan:{view:'gallery',accent:'orange',visual:'type',model:'explicit-cover-fixture',confidence:.9,decisionMs:100}},{type:'complete',content:gallery,generationModel:'explicit-cover-fixture',totalMs:900}].map(e=>JSON.stringify(e)).join('\n')+'\n'}));
  await p.goto(base);await p.locator('#prompt').fill('A listening collection');await p.getByRole('button',{name:'Generate interface',exact:true}).click();
  await p.getByText('Ready to try',{exact:true}).waitFor();
  const audit=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[]);
  await p.screenshot({path:`output/playwright/collection-photo-${size.width}.png`});
  while(!await p.getByText('Tomorrow, slowly',{exact:true}).isVisible())await p.getByRole('button',{name:'Next preview page'}).click();
  const pairs=await auditColors(p);assert.ok(pairs.every(pair=>pair.pass),JSON.stringify(pairs.filter(pair=>!pair.pass)));
  await p.screenshot({path:`output/playwright/collection-type-${size.width}.png`});
  await p.locator('.is-typographic').first().click();await p.getByRole('button',{name:'Close collection item'}).waitFor();await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  visuals.push({width:size.width,contrastPairs:pairs.length});await context.close();
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile('output/playwright/experience.json',JSON.stringify({metricsBeforeItems:true,stableTitle:true,interactionDuringStream:true,share:['native','clipboard','manual'],visuals},null,2));
 console.log('Metrics before items, stable layout, streaming interaction, native/copy/manual sharing, explanation disclosure and visual covers verified.');
} finally {await browser.close();}
