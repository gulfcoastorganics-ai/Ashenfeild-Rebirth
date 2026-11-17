import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import assert from "node:assert/strict";

/**
 * Browser-played combat, not direct calls to hurtEnemy or finishWave.
 * localhost-only fixture arranges the encounter; all damage thereafter uses F/Space
 * keyboard events, gameplay cooldowns, hit rules and actual attack resolution.
 */
const root=resolve(import.meta.dirname,"..");
const types={".html":"text/html",".css":"text/css",".js":"text/javascript",".mjs":"text/javascript"};
const server=createServer(async(req,res)=>{
 try{
  const url=decodeURIComponent((req.url||"/").split("?")[0]);
  const path=resolve(root,"."+url+(url==="/"? "index.html":""));
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end("Forbidden");return;}
  const data=await readFile(path);
  res.writeHead(200,{"Content-Type":types[extname(path)]||"application/octet-stream"});
  res.end(data);
 }catch(e){res.writeHead(404);res.end("Not found");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:1024,height:640},deviceScaleFactor:1});
 const jsErrors=[];page.on("pageerror",error=>jsErrors.push(error.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>Boolean(window.__ashfordQA),null,{timeout:90000});
 await page.locator("#start-button").click();
 const snap=()=>page.evaluate(()=>window.__ashfordQA.snapshot());
 const setup=(type,range)=>page.evaluate(([t,r])=>window.__ashfordQA.combatSetup(t,r),[type,range]);
 const add=(type,range)=>page.evaluate(([t,r])=>window.__ashfordQA.combatAdd(t,r),[type,range]);

 // First confirm enemy attack phases genuinely affect the player in real browser time.
 await setup("walker",1.4);
 await page.evaluate(()=>window.__ashfordQA.noDamage(false));
 await page.waitForFunction(()=>window.__ashfordQA.snapshot().health<100,null,{timeout:25000});
 assert((await snap()).health<100);
 console.log("PASS ENEMY ATTACK: Walker telegraph resolves into actual player health loss");

 // Live weapon inputs, not a test-only kill helper.
 await setup("walker",6);
 async function defeat(targetCount,weapon,limit=7){
  const k=weapon==="pistol"?"f":"Space";
  const start=await snap();let firstDamage=false;
  for(let i=0;i<limit;i++){
   await page.keyboard.press(k);
   await page.waitForTimeout(850);
   const s=await snap();
   if(s.enemies.some(e=>e.hp<e.max))firstDamage=true;
   if(s.waveKills>=targetCount)break;
  }
  const end=await snap();
  assert.equal(end.waveKills,targetCount,weapon+" failed to defeat target "+targetCount+" ("+JSON.stringify(end)+")");
  assert(firstDamage||end.waveKills===targetCount,"No genuine weapon hit recorded");
  console.log("PASS PLAYER COMBAT: "+weapon+" defeated infected "+targetCount+"; kills="+end.waveKills);
 }
 await defeat(1,"pistol",5);
 await add("brute",5);
 await defeat(2,"pistol",7);
 await add("runner",2.1);
 await defeat(3,"melee",5);
 await add("walker",2);
 await defeat(4,"melee",6);
 const final=await snap();
 assert.equal(final.stage,8,"Real kills should advance clinic objective to gate");
 assert(final.ammo<90,"Pistol ammo was not consumed");
 assert(await page.locator("#crosshair").count()===1);
 await mkdir(resolve(root,"artifacts"),{recursive:true});
 await page.screenshot({path:resolve(root,"artifacts","combat-verified.png"),animations:"disabled"});
 assert.deepEqual(jsErrors,[]);
 console.log("PASS COMBAT WAVE: Four infected defeated using keyboard-fired attacks and normal HP reductions");
}catch(e){console.error("COMBAT PLAYTHROUGH FAILED",e.stack||e);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));}
