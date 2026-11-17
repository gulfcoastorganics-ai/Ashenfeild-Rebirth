import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import assert from "node:assert/strict";

const root=resolve(import.meta.dirname,"..");
const types={".html":"text/html",".css":"text/css",".js":"text/javascript",".mjs":"text/javascript"};
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
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>Boolean(window.__ashfordQA),null,{timeout:60000});
 await page.locator("#loader.hide").waitFor({timeout:60000});
 await page.locator("#start-button").click();
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
 await page.screenshot({path:resolve(root,"artifacts","v08-reference-clinic.png"),animations:"disabled"});
 const clinic=await page.evaluate(()=>window.__ashfordQA.perf());
 assert(clinic.drawCalls>0&&clinic.drawCalls<480,"Clinic render budget exceeded: "+clinic.drawCalls);
 assert(clinic.geometries<190,"Too many geometries: "+clinic.geometries);
 await page.evaluate(()=>window.__ashfordQA.referenceView(-11,-26,0,2));
 await page.waitForTimeout(700);
 await page.screenshot({path:resolve(root,"artifacts","v08-reference-market.png"),animations:"disabled"});
 const market=await page.evaluate(()=>window.__ashfordQA.perf());
 assert(market.drawCalls>0&&market.drawCalls<480);
 assert.deepEqual(errors,[]);
 const result={description:"V0.8 reference-aligned clinic/market visual validation",environment:"Chromium headless SwiftShader (NOT real GPU)",clinic,market};
 await writeFile(resolve(root,"artifacts","v08-reference-audit.json"),JSON.stringify(result,null,2));
 console.log("REFERENCE CLINIC "+JSON.stringify(clinic));
 console.log("REFERENCE MARKET "+JSON.stringify(market));
 console.log("PASS V0.8 REFERENCE: HUD, functional light toggle and both 3D scenes render within resource budgets");
}catch(err){console.error("REFERENCE VISUAL QA FAILED:",err.stack||err);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});await new Promise(done=>server.close(done));}
