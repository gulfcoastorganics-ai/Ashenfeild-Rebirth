import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import assert from "node:assert/strict";

const root=resolve(import.meta.dirname,"..");
const types={".html":"text/html",".css":"text/css",".js":"text/javascript",".mjs":"text/javascript",".webp":"image/webp",".glb":"model/gltf-binary"};
const server=createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent((req.url||"/").split("?")[0]);
  const file=resolve(root,"."+name+(name==="/"? "index.html":""));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream"});
  res.end(await readFile(file));
 }catch(e){res.writeHead(404);res.end("Not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:1200,height:720},deviceScaleFactor:1});
 await page.addInitScript(()=>localStorage.setItem("ashfordAdaptiveCharacters","off"));
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>Boolean(window.__ashfordQA),null,{timeout:60000});
 await page.locator("#loader").waitFor({state:"detached",timeout:60000});
 await page.locator("#start-button").click();
 await page.waitForFunction(()=>window.__ashfordQA.perf().photoAssets.colors===4);
 await page.waitForFunction(()=>window.__ashfordQA.perf().characters.some(r=>r.kind==="player"&&r.shown),null,{timeout:30000});
 await page.evaluate(()=>window.__ashfordQA.referenceView(44,-25.7,0,6));
 await page.waitForTimeout(1100);
 assert(await page.locator("#hud").isVisible());
 assert((await page.locator("#objective-title").innerText()).includes("Dr. Vale"));
 assert(await page.locator(".environment-readout").isVisible());
 assert(await page.locator(".weapon-card").isVisible());
 assert((await page.locator("#world-clock").innerText()).includes("DAY"));
 assert.equal(await page.locator("#light-button").getAttribute("aria-pressed"),"false");
 await page.locator("#light-button").click();
 assert.equal(await page.locator("#light-button").getAttribute("aria-pressed"),"true");
 await page.locator("#light-button").click();
 assert.equal(await page.locator("#light-button").getAttribute("aria-pressed"),"false");
 await mkdir(resolve(root,"artifacts"),{recursive:true});
 await page.screenshot({path:resolve(root,"artifacts","v011-reference-clinic.png"),animations:"disabled"});
 const clinic=await page.evaluate(()=>window.__ashfordQA.perf());
 assert(clinic.materialSheet,"Surface atlas failed to load");
 assert.equal(clinic.surfaceRelief,false,"Auto mode enabled Quality-only relief");
 assert.equal(clinic.photoAssets.detail,0,"Auto mode activated the high-quality detail maps");
 assert(clinic.drawCalls>0&&clinic.drawCalls<480,"Clinic render budget exceeded: "+clinic.drawCalls);
 assert(clinic.geometries<190,"Too many geometries: "+clinic.geometries);
 await page.waitForFunction(()=>["vale","guard"].every(kind=>window.__ashfordQA.perf().characters.some(r=>r.kind===kind&&r.shown)),null,{timeout:30000});
 await page.evaluate(()=>window.__ashfordQA.referenceView(-11,-26,0,2));
 await page.waitForFunction(()=>window.__ashfordQA.perf().marketShelf);
 await page.waitForFunction(()=>window.__ashfordQA.perf().characters.some(r=>r.kind==="mara"&&r.shown),null,{timeout:30000});
 await page.screenshot({path:resolve(root,"artifacts","v011-reference-market.png"),animations:"disabled"});
 const market=await page.evaluate(()=>window.__ashfordQA.perf());
 assert(market.drawCalls>0&&market.drawCalls<480);
 await page.setViewportSize({width:602,height:560});
 await page.evaluate(()=>window.__ashfordQA.referenceView(44,-25.7,0,6));
 await page.waitForTimeout(650);
 assert(await page.locator("#mobile-controls").isHidden(),"Touch controls obstruct the narrow desktop view");
 assert(await page.locator(".weapon-card").isVisible(),"Weapon card missing in the narrow desktop view");
 await page.screenshot({path:resolve(root,"artifacts","v011-reference-clinic-narrow.png"),animations:"disabled"});
 await page.evaluate(()=>window.__ashfordQA.referenceView(-47,-17.8,Math.PI,0,0));
 await page.waitForTimeout(650);
 await page.screenshot({path:resolve(root,"artifacts","v011-safehouse-survivor.png"),animations:"disabled"});
 await page.evaluate(()=>window.__ashfordQA.referenceView(-54,-15.15,0,0));
 await page.waitForFunction(()=>window.__ashfordQA.perf().cameraLength<.45);
 await page.evaluate(()=>window.__ashfordQA.referenceView(-48,-24,Math.PI,0));
 await page.waitForFunction(()=>window.__ashfordQA.perf().cameraLength>.85);
 await page.locator("#pause-button").click();
 await page.waitForFunction(()=>window.__ashfordQA.perf().audio.active===false);
 await page.locator("#sound-volume").evaluate(input=>{
  input.value="0";input.dispatchEvent(new Event("input",{bubbles:true}));
 });
 assert(await page.evaluate(()=>window.__ashfordQA.perf().audio.muted&&localStorage.getItem("ashfordVolume")==="0"));
 await page.locator("#camera-shoulder").click();
 assert.equal(await page.evaluate(()=>localStorage.getItem("ashfordShoulder")),"left");
 await page.locator("#camera-shoulder").click();
 const graphics=page.locator("#quality-button");
 for(const mode of ["PERFORMANCE","BALANCED","QUALITY"]){
  await graphics.click();
  assert.equal(await graphics.innerText(),"GRAPHICS: "+mode);
 }
 await page.locator("#resume").click();
 await page.evaluate(()=>window.__ashfordQA.referenceView(-48,-24,Math.PI,0));
 await page.waitForFunction(()=>{
  const render=window.__ashfordQA.perf();
  return render.renderTier==="quality"&&render.shadows&&render.surfaceRelief&&render.skyReflections&&render.photoAssets.detail===4&&render.sceneGrade==="safehouse";
 });
 await page.screenshot({path:resolve(root,"artifacts","v0131-safehouse-quality.png"),animations:"disabled"});
 await page.locator("#pause-button").click();
 const paused=await page.evaluate(()=>window.__ashfordQA.perf().characters.find(r=>r.kind==="player"));
 assert(paused.height>=2.5&&paused.height<=2.8,"In-game player model scale changed");
 const resident=await page.evaluate(()=>window.__ashfordQA.perf().textures);
 await page.locator("#fine-surfaces").uncheck();
 let render=await page.evaluate(()=>window.__ashfordQA.perf());
 assert.equal(render.photoAssets.detail,0);
 assert.equal(render.sceneGrade,"safehouse");
 await page.locator("#fine-surfaces").check();
 await page.locator("#scene-grade").uncheck();
 render=await page.evaluate(()=>window.__ashfordQA.perf());
 assert.equal(render.photoAssets.detail,4);
 assert.equal(render.sceneGrade,"neutral");
 for(let cycle=0;cycle<2;cycle++){
  for(const mode of ["AUTO","PERFORMANCE","BALANCED","QUALITY"]){
   await graphics.click();
   assert.equal(await graphics.innerText(),"GRAPHICS: "+mode);
  }
  await page.waitForFunction(()=>window.__ashfordQA.perf().photoAssets.detail===4);
 }
 const cycled=await page.evaluate(()=>window.__ashfordQA.perf());
 assert.equal(cycled.characters.find(r=>r.kind==="player").time,paused.time,"Paused mixer advanced on a tier change");
 assert(cycled.textures<=resident+2,"Texture allocation grew repeatedly when cycling presets");
 const models=page.locator("#detailed-characters");
 await models.uncheck();
 assert(!await page.evaluate(()=>window.__ashfordQA.perf().characters.some(r=>r.shown)),"Lightweight character mode still shows a skinned model");
 await models.check();
 assert(await page.evaluate(()=>window.__ashfordQA.perf().characters.some(r=>r.kind==="player"&&r.shown)),"The detailed player did not return after re-enabling the option");
 await page.locator("#resume").click();
 await page.evaluate(()=>window.__ashfordQA.combatSetup("walker",5));
 await page.waitForFunction(()=>window.__ashfordQA.perf().characters.some(r=>r.kind==="walker"&&r.shown),null,{timeout:30000});
 await page.evaluate(()=>{window.__ashfordQA.combatSetup("runner",5);window.__ashfordQA.combatAdd("brute",4);window.__ashfordQA.combatAdd("spitter",6);});
 await page.waitForFunction(()=>["runner","brute","spitter"].every(kind=>window.__ashfordQA.perf().characters.some(r=>r.kind===kind&&r.shown)),null,{timeout:30000});
 assert(!await page.evaluate(()=>window.__ashfordQA.perf().characters.some(r=>r.kind==="walker")),"Removed infected rig was retained");
 await page.keyboard.press("x");
 await page.waitForFunction(()=>window.__ashfordQA.perf().characters.some(r=>r.kind==="player"&&r.pose==="dodge"));
 const burst=await page.evaluate(()=>window.__ashfordQA.effectFixture());
 for(const [type,active] of Object.entries(burst.active))assert.equal(active,burst.limits[type],type+" pool cap");
 await page.waitForFunction(()=>Object.values(window.__ashfordQA.perf().effects).every(count=>count===0));
 assert.deepEqual(errors,[]);
 await page.close();
 const fallback=await browser.newPage({viewport:{width:640,height:480},deviceScaleFactor:1});
 fallback.on("pageerror",e=>errors.push(e.message));
 await fallback.route("**/assets/{surfaces/**,characters/**,market-shelf.glb}",route=>route.abort());
 await fallback.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded"});
 await fallback.waitForFunction(()=>Boolean(window.__ashfordQA));
 await fallback.locator("#start-button").click();
 await fallback.evaluate(()=>window.__ashfordQA.referenceView(-11,-26,0,2));
 await fallback.waitForFunction(()=>window.__ashfordQA.perf().drawCalls>0);
 const degraded=await fallback.evaluate(()=>window.__ashfordQA.perf());
 assert.equal(degraded.photoAssets.colors,0);
 assert.equal(degraded.marketShelf,false);
 assert.equal(degraded.characters.length,0,"Unavailable GLB did not leave the fallback character active");
 assert(await fallback.locator("#hud").isVisible());
 assert.deepEqual(errors,[]);
 const result={description:"V0.13.1 material and prop validation",environment:"Chromium headless SwiftShader (CPU rendering)",clinic,market,degraded};
 await writeFile(resolve(root,"artifacts","v0131-reference-audit.json"),JSON.stringify(result,null,2));
 console.log("REFERENCE CLINIC "+JSON.stringify(clinic));
 console.log("REFERENCE MARKET "+JSON.stringify(market));
 console.log("PASS V0.15 REFERENCE: avatar and fallback, paused mixer, camera obstruction and recovery, mute and shoulder settings, tier cycling and bounded effects");
}catch(err){console.error("REFERENCE VISUAL QA FAILED:",err.stack||err);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});await new Promise(done=>server.close(done));}
