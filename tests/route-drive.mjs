import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";

// Keyboard-only traversal: no teleportation, world coordinates used for route planning only.
const root=resolve(import.meta.dirname,"..");
const mime={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css"};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent((req.url||"/").split("?")[0]);
  const file=resolve(root,"."+pathname+(pathname==="/"? "index.html":""));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(file);
  res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});res.end(data);
 }catch(e){res.writeHead(404);res.end("Not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Boolean(window.__ashfordQA),null,{timeout:60000});
 await page.locator("#loader.hide").waitFor({timeout:60000});
 await page.locator("#start-button").click();
 await page.evaluate(()=>window.__ashfordQA.noDamage(true));
 const snapshot=()=>page.evaluate(()=>window.__ashfordQA.snapshot());
 async function moveAxis(axis,target,tolerance=.65){
  let stalled=0,lastDistance=Infinity;
  for(let n=0;n<110;n++){
   const p=await snapshot(),current=p[axis],delta=target-current;
   if(Math.abs(delta)<=tolerance)return;
   const code=axis==="x"?(delta>0?"a":"d"):(delta>0?"w":"s");
   const duration=Math.max(90,Math.min(640,Math.abs(delta)*140));
   await page.keyboard.down(code);
   await page.waitForTimeout(duration);
   await page.keyboard.up(code);
   const next=await snapshot(),remaining=Math.abs(target-next[axis]);
   if(remaining>lastDistance-.07)stalled++;else stalled=0;
   lastDistance=remaining;
   if(stalled>=7)throw new Error("Physical traversal blocked on "+axis+" near ("+next.x.toFixed(1)+","+next.z.toFixed(1)+") toward "+target);
  }
  throw new Error("Exceeded movement budget on "+axis+" toward "+target);
 }
 async function to(x,z,order="xz"){
  for(const axis of order)await moveAxis(axis,axis==="x"?x:z);
 }
 async function stageAtLeast(stage,name){
  await page.waitForFunction(s=>window.__ashfordQA.snapshot().stage>=s,stage,{timeout:15000});
  console.log("PASS Physical traversal: "+name+" at "+JSON.stringify(await snapshot()));
 }
 async function use(name,expected,speaker){
  await page.keyboard.press("e");
  if(speaker){
   await page.locator("#dialogue").waitFor({timeout:12000});
   assert.equal(await page.locator("#dialogue-speaker").innerText(),speaker);
   await page.locator("#dialogue-next").click();
  }
  await stageAtLeast(expected,name);
 }

 // First exit, then travel along the exterior of the buildings, entering via front gaps.
 await to(-47,-10.8,"xz");await stageAtLeast(1,"safehouse exit");
 await to(-11,-10.6,"zx");await moveAxis("z",-11.7);await stageAtLeast(2,"Last Stop exterior");
 await to(-13.2,-24.6,"xz");await use("Mara dialogue",3,"MARA");
 await to(-7,-28.6,"xz");await use("market supplies",4);
 await to(-11,-10.4,"xz");
 await to(17,-10.4,"zx");await to(17,2.7,"xz");await use("patrol car",5);
 await to(44,2.7,"zx");await to(44,-11.1,"xz");await stageAtLeast(6,"clinic exterior");
 await to(44,-27,"xz");await to(48,-27.5,"xz");await use("Dr. Vale dialogue",7,"DR. VALE");

 await mkdir(resolve(root,"artifacts"),{recursive:true});
 await page.screenshot({path:resolve(root,"artifacts","keyboard-clinic.png"),animations:"disabled"});
 const perf=await page.evaluate(()=>window.__ashfordQA.perf());
 assert(perf.sampleCount>=10&&perf.drawCalls>0,"Performance instrumentation unavailable");
 console.log("PERFORMANCE (headless SwiftShader only): "+JSON.stringify(perf));

 // The combat wave is isolated by resolving it via localhost-only test hooks.
 // This validates the final movement and gate interaction, NOT combat playability.
 await page.evaluate(()=>window.__ashfordQA.finishWave());
 await stageAtLeast(8,"clinic defense scripted result");
 await to(44,-15.1,"xz");
 await page.keyboard.press("e");
 await page.waitForFunction(()=>window.__ashfordQA.snapshot().ended,null,{timeout:15000});
 assert((await page.locator("#end-title").innerText()).includes("FIRST NIGHT"));
 await page.screenshot({path:resolve(root,"artifacts","keyboard-victory.png"),animations:"disabled"});
 assert.deepEqual(errors,[],"Uncaught browser errors");
 console.log("PASS KEYBOARD ROUTE: market, supplies, patrol, clinic and gate reached by movement controls; combat simulated");
}catch(e){console.error("KEYBOARD ROUTE FAILURE:",e.stack||e);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});await new Promise(done=>server.close(done));}
