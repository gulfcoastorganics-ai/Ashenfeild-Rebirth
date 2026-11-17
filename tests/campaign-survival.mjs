import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import assert from "node:assert/strict";

/**
 * Normal-rules campaign integration: no teleport, no invulnerability, no staged
 * enemies and no simulated kills. The localhost QA surface is READ ONLY here.
 * All actions use keyboard keys and ordinary inventory clicks.
 * Test does not claim to be an unaided human playthrough.
 */
const root=resolve(import.meta.dirname,"..");
const mime={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css"};
const server=createServer(async(req,res)=>{
 try{
  const pathName=decodeURIComponent((req.url||"/").split("?")[0]);
  const file=resolve(root,"."+pathName+(pathName==="/"? "index.html":""));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(file);
  res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});
  res.end(bytes);
 }catch(e){res.writeHead(404);res.end("Not found");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded",timeout:90000});
 await page.waitForFunction(()=>Boolean(window.__ashfordQA),null,{timeout:90000});
 await page.locator("#start-button").click();
 const snap=()=>page.evaluate(()=>window.__ashfordQA.snapshot());
 const wait=ms=>page.waitForTimeout(ms);
 function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
 const ensureAlive=async label=>{const s=await snap();assert(!s.ended&&s.health>0,"Player died during "+label+" at "+JSON.stringify(s));return s;};
 async function aimAt(x,z,tolerance=.13){
  for(let i=0;i<18;i++){
   const p=await ensureAlive("aim");
   const yaw=Math.atan2(-(x-p.x),-(z-p.z));
   const err=angleDiff(yaw,p.cameraYaw);
   if(Math.abs(err)<tolerance)return;
   const key=err>0?"q":"r";
   await page.keyboard.down(key);
   await wait(Math.max(100,Math.min(440,Math.abs(err)/2.8*800)));
   await page.keyboard.up(key);
  }
  throw new Error("Unable to align camera aim");
 }
 async function moveAxis(axis,target,tolerance=.75){
  let stalled=0,last=Infinity;
  for(let n=0;n<125;n++){
   const p=await ensureAlive("movement"),delta=target-p[axis];
   if(Math.abs(delta)<=tolerance)return;
   const key=axis==="x"?(delta>0?"a":"d"):(delta>0?"w":"s");
   await page.keyboard.down(key);
   await wait(Math.max(90,Math.min(610,Math.abs(delta)*135)));
   await page.keyboard.up(key);
   const now=await snap(),remaining=Math.abs(target-now[axis]);
   if(remaining>last-.06)stalled++;else stalled=0;
   last=remaining;
   if(stalled>=9)throw new Error("Blocked on "+axis+" at "+JSON.stringify(now)+" toward "+target);
  }
  throw new Error("Exceeded movement budget toward "+target);
 }
 async function to(x,z,order="xz"){for(const a of order)await moveAxis(a,a==="x"?x:z);}
 async function reached(stage,name){
  await page.waitForFunction(s=>window.__ashfordQA.snapshot().stage>=s,stage,{timeout:15000});
  const p=await ensureAlive(name);
  console.log("CAMPAIGN PASS "+name+" stage="+p.stage+" HP="+p.health.toFixed(1));
 }
 async function use(name,stage,speaker=null){
  await page.keyboard.press("e");
  if(speaker){
   await page.locator("#dialogue").waitFor({timeout:15000});
   assert.equal(await page.locator("#dialogue-speaker").innerText(),speaker);
   await page.locator("#dialogue-next").click();
  }
  await reached(stage,name);
 }
 async function bandage(){
  const s=await snap();
  if(s.inventory?.bandage<=0||s.health>64)return;
  await page.keyboard.press("i");
  await page.locator(".inv-cell").filter({hasText:"BANDAGE"}).click();
  await page.keyboard.press("Escape");
  console.log("CAMPAIGN ACTION bandage "+JSON.stringify((await snap()).health));
 }
 await to(-47,-10.8);await reached(1,"safehouse exit");
 await to(-11,-10.6,"zx");await moveAxis("z",-11.7);await reached(2,"market exterior");
 await to(-13.2,-24.6);await use("Mara",3,"MARA");
 await to(-7,-28.6);await use("supplies",4);
 await to(-11,-10.4);
 await to(17,-10.4,"zx");await to(17,2.7);await use("patrol pistol",5);
 await bandage();
 await to(44,2.7,"zx");await to(44,-11.1);await reached(6,"clinic exterior");
 await to(44,-27);await to(48,-27.5);await use("Dr. Vale",7,"DR. VALE");
 await bandage();
 // Approach the open clinic entrance, placing enemies in the shooting lane.
 await to(44,-16.7);
 await mkdir(resolve(root,"artifacts"),{recursive:true});
 await page.screenshot({path:resolve(root,"artifacts","survival-wave-start.png"),animations:"disabled"});
 let shots=0,dodges=0,heals=0,startedHP=(await snap()).health;
 for(let action=0;action<85;action++){
  let s=await ensureAlive("clinic defense");
  if(s.stage>=8)break;
  if(s.health<55&&s.inventory?.bandage>0){await bandage();heals++;continue;}
  const live=s.enemies.filter(e=>e.ambush&&e.hp>0);
  assert(live.length,"No living infected remaining before four kills");
  live.sort((a,b)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(b.x-s.x,b.z-s.z));
  const enemy=live[0],range=Math.hypot(enemy.x-s.x,enemy.z-s.z);
  if(range<2.8&&enemy.intent){
   await page.keyboard.press("x");dodges++;
   await wait(350);
  }
  s=await snap();
  await aimAt(enemy.x,enemy.z);
  await page.keyboard.press(range<2.35?"Space":"f");
  shots++;
  await wait(360);
 }
 const post=await ensureAlive("post-wave combat");
 assert.equal(post.stage,8,"Normal combat did not clear stage 7: "+JSON.stringify({health:post.health,kills:post.waveKills,ammo:post.ammo,shots,dodges,heals,enemy:post.enemies.slice(0,6)}));
 assert.equal(post.waveKills,4);
 assert(shots>0,"No attacks fired");
 console.log("CAMPAIGN PASS real clinic defense; HP "+startedHP.toFixed(1)+" -> "+post.health.toFixed(1)+" shots="+shots+" dodges="+dodges+" heals="+heals);
 // Move toward the gate by normal camera-relative controls. Do not require
 // an exact world heading after combat: at low FPS keyboard rotation is quantized.
 for(let n=0;n<32;n++){
  const q=await ensureAlive("gate approach"),d=Math.hypot(q.x-44,q.z+15);
  if(d<3.3)break;
  await aimAt(44,-15,.44);
  await page.keyboard.down("w");await wait(270);await page.keyboard.up("w");
 }
 const atGate=await ensureAlive("final gate");
 assert(Math.hypot(atGate.x-44,atGate.z+15)<3.8,"Could not walk to clinic gate: "+JSON.stringify(atGate));
 await page.keyboard.press("e");
 await page.waitForFunction(()=>window.__ashfordQA.snapshot().ended,null,{timeout:12000});
 assert((await page.locator("#end-title").innerText()).includes("FIRST NIGHT"),"Victory screen missing");
 await page.screenshot({path:resolve(root,"artifacts","survival-normal-victory.png"),animations:"disabled"});
 const perf=await page.evaluate(()=>window.__ashfordQA.perf());
 console.log("CAMPAIGN SOFTWARE RENDERER METRICS "+JSON.stringify(perf));
 assert.deepEqual(errors,[],"Uncaught JS errors");
 console.log("PASS NORMAL-RULES CAMPAIGN: keyboard route, living player, real combat, gate ending; read-only QA telemetry");
}catch(err){console.error("NORMAL CAMPAIGN FAILED",err.stack||err);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});await new Promise(done=>server.close(done));}
