import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import assert from "node:assert/strict";

const root=resolve(import.meta.dirname,"..");
const mime={".html":"text/html",".css":"text/css",".js":"text/javascript",".mjs":"text/javascript"};
const server=createServer(async(req,res)=>{
 try{
  const p=decodeURIComponent((req.url||"/").split("?")[0]),file=resolve(root,"."+p+(p==="/"? "index.html":""));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});
  res.end(await readFile(file));
 }catch(e){res.writeHead(404);res.end("Not found");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded",timeout:90000});
 await page.locator("#loader.hide").waitFor({timeout:90000});
 await page.locator("#start-button").tap();
 assert(await page.locator("#hud").isVisible());
 assert(await page.locator("#mobile-controls").isVisible());
 await page.locator("#mobile-attack").tap();
 const beforeRoll=await page.evaluate(()=>window.__ashfordQA.snapshot());
 await page.locator("#mobile-dodge").tap();
 const afterRoll=await page.evaluate(()=>window.__ashfordQA.snapshot());
 assert(afterRoll.stamina<beforeRoll.stamina,"Dodge did not consume stamina");
 assert(afterRoll.dodgeCooldown>0,"Dodge cooldown not started");

 await page.locator("#mobile-interact").tap();
 // Touch emulation checks responsive controls; not a physical phone benchmark.
 const before=await page.evaluate(()=>window.__ashfordQA.snapshot());
 const rect=await page.locator("#joystick").boundingBox();
 assert(rect,"Touch joystick absent");
 const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-38,{steps:4});
 await page.waitForTimeout(1400);await page.mouse.up();
 const after=await page.evaluate(()=>window.__ashfordQA.snapshot());
 const travel=Math.hypot(before.x-after.x,before.z-after.z);
 assert(travel>.10,"Joystick did not move survivor; distance="+travel.toFixed(2));
 // The FPS toggle remains usable on small viewports.
 await page.locator("#perf-button").tap();
 assert(await page.locator("#perf-panel").isVisible());
 await page.waitForTimeout(1700);
 const perf=await page.evaluate(()=>window.__ashfordQA.perf());
 assert(perf.sampleCount>=5&&perf.drawCalls>0,"Mobile viewport diagnostics missing");
 await mkdir(resolve(root,"artifacts"),{recursive:true});
 await page.screenshot({path:resolve(root,"artifacts","mobile-emulation.png"),animations:"disabled"});
 assert.deepEqual(errors,[]);
 console.log("PASS MOBILE EMULATION: 390x844 HUD, touch controls, virtual joystick, FPS panel");
 console.log("MOBILE EMULATED PERFORMANCE (SwiftShader, not Android/iOS hardware): "+JSON.stringify(perf));
}catch(e){console.error("MOBILE EMULATION FAILED:",e.stack||e);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});await new Promise(done=>server.close(done));}
