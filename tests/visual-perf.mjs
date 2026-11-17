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
let browser;const errors=[],samples=[];
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:1120,height:720},deviceScaleFactor:1});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>Boolean(window.__ashfordQA),null,{timeout:60000});
 await page.locator("#loader").waitFor({state:"detached",timeout:60000});
 await page.locator("#start-button").click();
 await mkdir(resolve(root,"artifacts"),{recursive:true});
 // Test-only camera repositioning used for image/resource sampling, not gameplay.
 const views=[
  {name:"safehouse",x:-48,z:-24},
  {name:"market",x:-11,z:-25},
  {name:"patrol",x:17,z:3},
  {name:"clinic",x:44,z:-25}
 ];
 for(const view of views){
  await page.evaluate(([x,z])=>window.__ashfordQA.teleport(x,z),[view.x,view.z]);
  await page.waitForTimeout(650);
  const metric=await page.evaluate(()=>window.__ashfordQA.perf());
  assert(metric.drawCalls>0&&metric.triangles>0,"Blank WebGL scene at "+view.name);
  assert(metric.geometries<190,"Excessive geometry allocations at "+view.name+": "+metric.geometries);
  assert(metric.drawCalls<440,"Draw call budget exceeded at "+view.name+": "+metric.drawCalls);
  await page.screenshot({path:resolve(root,"artifacts","v07-"+view.name+".png"),animations:"disabled"});
  samples.push({view:view.name,...metric});
  console.log("V0.7 RENDER SAMPLE "+view.name+" "+JSON.stringify(metric));
 }
 const output={build:"reconstruction-v0.7",measurement:"headless Chromium software SwiftShader, NOT GPU or phone FPS",views:samples};
 await writeFile(resolve(root,"artifacts","v07-render-audit.json"),JSON.stringify(output,null,2));
 assert.deepEqual(errors,[],"Uncaught JS errors");
 console.log("PASS V0.7 VISUAL QA: Four scenes captured and WebGL resource counts within budget");
}catch(e){console.error("V0.7 VISUAL QA FAILED",e.stack||e);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});await new Promise(done=>server.close(done));}
