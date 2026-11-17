import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";

const root=resolve(import.meta.dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
const server=createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent((req.url||"/").split("?")[0]);
  const file=resolve(root,"."+name+(name==="/"? "index.html":""));
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream","Cache-Control":"no-store"});res.end(body);
 }catch(e){res.writeHead(404);res.end("Not found");}
});
await new Promise((resolve,reject)=>server.listen(0,"127.0.0.1",e=>e?reject(e):resolve()));
const port=server.address().port;
let browser;
const failures=[],consoleErrors=[];
const report=(name,status,detail="")=>{console.log(status+" "+name+(detail?" — "+detail:""));if(status!=="PASS")failures.push(name+(detail?": "+detail:""));};
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on("pageerror",e=>consoleErrors.push("PAGE: "+e.message));
 page.on("console",message=>{if(message.type()==="error")consoleErrors.push("CONSOLE: "+message.text());});
 page.on("requestfailed",req=>consoleErrors.push("NETWORK: "+req.url()+" "+req.failure()?.errorText));
 await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
 try{
  await page.locator("#loader.hide").waitFor({timeout:45000});
  report("WebGL engine initialized","PASS");
 }catch(e){
  report("WebGL engine initialized","FAIL",(await page.locator("#loader").innerText().catch(()=>"Missing loader")).slice(0,180));
  throw e;
 }
 assert(await page.locator("#start-button").isVisible(),"Start button not visible");
 await mkdir(resolve(root,"artifacts"),{recursive:true});
 await page.screenshot({path:resolve(root,"artifacts","start.png"),animations:"disabled"});
 await page.locator("#start-button").click();
 assert(await page.locator("#hud").isVisible(),"HUD did not appear");
 assert(await page.locator("#objective-title").innerText()==="Exit the barricaded house","Wrong opening objective");
 report("Start menu, scene, HUD and first mission","PASS");
 await page.screenshot({path:resolve(root,"artifacts","in-game.png"),animations:"disabled"});
 const before=Number((await page.locator("#waypoint-distance").innerText()).match(/\d+/)?.[0]||NaN);
 await page.keyboard.down("w");
 await page.waitForTimeout(1150);
 await page.keyboard.up("w");
 const after=Number((await page.locator("#waypoint-distance").innerText()).match(/\d+/)?.[0]||NaN);
 assert(after<before,"Moving forward failed to approach opening waypoint: "+before+" -> "+after);
 report("Keyboard walking and forward camera alignment","PASS",before+"m -> "+after+"m");
 await page.keyboard.press("i");
 assert(await page.locator("#pack-modal").isVisible(),"Pack did not open");
 assert(await page.locator(".inv-cell").count()>=6,"Inventory incomplete");
 await page.keyboard.press("Escape");
 assert(!(await page.locator("#pack-modal").isVisible()),"Pack did not close");
 report("Inventory open / close","PASS");
 await page.keyboard.press("Escape");
 assert(await page.locator("#pause-modal").isVisible(),"Pause menu did not open");
 assert(await page.locator("#quality-button").isVisible(),"Graphics toggle missing");
 const beforeQuality=(await page.locator("#quality-button").innerText()).trim();
 await page.locator("#quality-button").click();
 const afterQuality=(await page.locator("#quality-button").innerText()).trim();
 assert.notEqual(afterQuality,beforeQuality,"Graphics mode button failed to toggle from "+beforeQuality);
 if(!afterQuality.includes("PERFORMANCE")){
  await page.locator("#quality-button").click();
  assert((await page.locator("#quality-button").innerText()).includes("PERFORMANCE"),"Manual Performance mode unavailable");
 }
 async function assertGraphics(selected,tier,shadows){
  const graphics=await page.evaluate(()=>({stored:localStorage.getItem("ashfordGraphicsV02"),...window.__ashfordQA.perf()}));
  assert.equal(graphics.stored,selected);
  assert.equal(graphics.quality,selected);
  assert.equal(graphics.renderTier,tier);
  assert.equal(graphics.shadows,shadows);
 }
 await assertGraphics("performance","performance",false);
 for(const [selected,tier] of [["balanced","balanced"],["quality","quality"],["auto","balanced"]]){
  await page.locator("#quality-button").click();
  await assertGraphics(selected,tier,true);
 }
 await page.locator("#quality-button").click();
 await assertGraphics("performance","performance",false);
 await page.locator("#resume").click();
 report("Pause / resume and quality preset","PASS");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("ashfordRebirthV01")||"null"));
 assert(saved&&typeof saved.stage==="number","No checkpoint saved when opening pause");
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator("#loader.hide").waitFor({timeout:45000});
 await page.locator("#start-button").click();
 assert(await page.locator("#hud").isVisible(),"Reloaded game failed to start");
 await assertGraphics("performance","performance",false);
 // Wait for the first refreshed HUD frame rather than asserting against the "-- m" placeholder.
 try{
  await page.waitForFunction(maxDistance=>{
   const value=document.getElementById("waypoint-distance")?.textContent||"";
   const match=value.match(/(\d+)\s*m/);
   return match&&Number(match[1])<=maxDistance+2;
  },after,{timeout:20000});
 }catch(e){
  const actual=await page.locator("#waypoint-distance").innerText();
  throw new Error("Checkpoint position not restored or HUD stale: expected <= "+(after+2)+"m, got '"+actual+"'");
 }
 const newDist=Number((await page.locator("#waypoint-distance").innerText()).match(/\d+/)?.[0]);
 report("Local checkpoint on restart","PASS",newDist+"m to waypoint");
 await page.screenshot({path:resolve(root,"artifacts","resumed.png"),animations:"disabled"});
 // A loaded game may emit the expected fallback warning on software graphics; only fail on genuine JS/network failures.
 const critical=consoleErrors.filter(s=>/PAGE:|NETWORK:.*(?:three\.module|nav\.mjs|game\.js)/.test(s));
 assert(critical.length===0,"Browser module/runtime failures: "+critical.join(" | "));
 report("No uncaught JS or module load failures","PASS");

 // Scripted, browser-rendered mission transitions. Teleports are available ONLY on 127.0.0.1/?__qa=1.
 // This verifies all route objectives and interactions, not physical traversal or combat balancing.
 await page.close(); // Stop the first WebGL scene before starting a second software-rendered scene.
 const route=await browser.newPage({viewport:{width:1024,height:640},deviceScaleFactor:1});
 route.on("pageerror",err=>consoleErrors.push("ROUTE PAGE: "+err.message));
 await route.goto("http://127.0.0.1:"+port+"/?__qa=1",{waitUntil:"domcontentloaded",timeout:90000});
 await route.waitForFunction(()=>Boolean(window.__ashfordQA),null,{timeout:45000});
 await route.locator("#start-button").click();
 const snapshot=()=>route.evaluate(()=>window.__ashfordQA.snapshot());
 async function warp(x,z,expected){
  await route.evaluate(([a,b])=>window.__ashfordQA.teleport(a,b),[x,z]);
  await route.waitForFunction(stage=>window.__ashfordQA.snapshot().stage===stage,expected,{timeout:15000});
 }
 async function use(x,z,expected,speaker=null){
  await route.evaluate(([a,b])=>window.__ashfordQA.teleport(a,b),[x,z]);
  await route.keyboard.press("e");
  if(speaker){
   await route.locator("#dialogue").waitFor({timeout:15000});
   assert.equal(await route.locator("#dialogue-speaker").innerText(),speaker);
   await route.locator("#dialogue-next").click();
  }
  await route.waitForFunction(stage=>window.__ashfordQA.snapshot().stage===stage,expected,{timeout:15000});
 }
 await warp(-47,-11,1); // Leave barricaded house
 await warp(-11,-15,2); // Market exterior
 await use(-14,-25,3,"MARA"); // Dialogue
 await use(-7,-29,4); // Supplies
 let progress=await snapshot();
 assert.equal(progress.supplies,1);
 await use(17,3,5); // Patrol car weapon
 progress=await snapshot();
 assert.equal(progress.hasGun,true);
 assert(progress.ammo>=12,"Patrol car did not supply ammunition");
 await warp(44,-15,6); // Clinic exterior
 await use(48,-28,7,"DR. VALE"); // Clinic dialogue, begin defense
 await route.screenshot({path:resolve(root,"artifacts","clinic-defense.png"),animations:"disabled"});
 await route.evaluate(()=>window.__ashfordQA.finishWave()); // Deterministic combat resolution callback
 await route.waitForFunction(()=>window.__ashfordQA.snapshot().stage===8,null,{timeout:15000});
 progress=await snapshot();assert.equal(progress.waveKills,4);
 await use(44,-15,8); // Final gate interaction invokes victory
 await route.waitForFunction(()=>window.__ashfordQA.snapshot().ended,null,{timeout:15000});
 assert(await route.locator("#end-title").isVisible(),"Ending screen not visible");
 assert((await route.locator("#end-title").innerText()).includes("FIRST NIGHT"));
 report("Scripted market–patrol–clinic mission transitions","PASS","9 objectives, NPC dialogue, pickups, defense and victory");
 console.log("BROWSER QA PASS: smoke and scripted mission progression complete");

}catch(err){
 console.error("BROWSER SMOKE FAILED",err.stack||err);
 if(!failures.length)failures.push(err.message||String(err));
 process.exitCode=1;
}finally{
 if(consoleErrors.length)console.log("BROWSER CONSOLE:",consoleErrors.slice(0,12).join(" | "));
 await browser?.close().catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}
