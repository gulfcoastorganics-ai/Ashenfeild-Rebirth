import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {extname,resolve,sep} from "node:path";
import {chromium} from "playwright";

const root=resolve(import.meta.dirname,".."),artifacts=resolve(root,"artifacts");
const mime={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css",".webp":"image/webp",".glb":"model/gltf-binary"};
const server=createServer(async(req,res)=>{
 try{
  const name=new URL(req.url,"http://127.0.0.1").pathname;
  const path=resolve(root,"."+name+(name==="/"?"index.html":""));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  const payload=await readFile(path);
  res.writeHead(200,{"Content-Type":mime[extname(path)]??"application/octet-stream"}).end(payload);
 }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const url="http://127.0.0.1:"+server.address().port+"/?__qa=1";
const legacy={stage:5,x:-48,z:-24,health:90,stamina:100,hunger:75,thirst:70,hasGun:true,ammo:36,supplies:1,inventory:{water:1,food:2,bandage:1},kills:0};
const errors=[];
let browser;

async function newFixture(checkpoint,mobile=false){
 const page=await browser.newPage(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:960,height:600}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.addInitScript(saved=>{
  if(localStorage.getItem("ashfordRebirthV01")===null)localStorage.setItem("ashfordRebirthV01",JSON.stringify(saved));
  localStorage.setItem("ashfordGraphicsV02","performance");
  localStorage.setItem("ashfordDetailedCharacters","off");
 },checkpoint);
 await page.goto(url,{waitUntil:"domcontentloaded"});
 await page.locator("#loader").waitFor({state:"detached",timeout:45000});
 await page.locator("#start-button")[mobile?"tap":"click"]();
 return page;
}

const snap=page=>page.evaluate(()=>window.__ashfordQA.snapshot());
const save=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("ashfordRebirthV01")));
const capture=(page,name)=>page.screenshot({path:resolve(artifacts,"v016-"+name+".png"),animations:"disabled"});
async function open(player,title){
 await player.keyboard.press("e");
 await player.locator("#field-title").waitFor({state:"visible",timeout:7000});
 assert.equal(await player.locator("#field-title").textContent(),title);
}
async function walk(page,axis,goal,tolerance=.72){
 const forward=axis==="x"?"a":"w",backward=axis==="x"?"d":"s";
 for(let i=0;i<75;i++){
  const player=await snap(page),delta=goal-player[axis];
  assert(!player.ended,"Survivor died while traveling toward "+axis+"="+goal);
  if(Math.abs(delta)<tolerance)return;
  const key=delta>0?forward:backward;
  await page.keyboard.down(key);
  await page.waitForTimeout(Math.max(85,Math.min(590,Math.abs(delta)*127)));
  await page.keyboard.up(key);
 }
 throw Error("Could not reach "+axis+"="+goal+" from "+JSON.stringify(await snap(page)));
}
async function reload(page){
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator("#loader").waitFor({state:"detached",timeout:45000});
 await page.locator("#start-button").click();
}

try{
 await mkdir(artifacts,{recursive:true});
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
 const page=await newFixture(legacy);
 assert.equal((await save(page)).version,2);
 assert.equal((await snap(page)).stage,legacy.stage);
 await walk(page,"x",-42);
 await open(page,"Safehouse footlocker");
 await capture(page,"scavenging");
 await page.locator("#field-items button").getByText("TAKE SUPPLIES").click();
 assert.match(await page.locator("#field-status").textContent(),/Already searched.+Recovered/);
 const footlocker=(await save(page)).sandbox.looted;
 assert.equal(footlocker["safehouse-kit"],true);
 await page.keyboard.press("Escape");
 await open(page,"Safehouse footlocker");
 assert.equal(await page.locator("#field-items button").count(),0);
 await page.keyboard.press("Escape");
 await page.keyboard.press("i");
 await page.locator("#craft-tab").click();
 await page.getByRole("button",{name:/CRAFT DOOR BRACE KIT/}).click();
 assert.equal(await page.locator("#pack-status").textContent(),"Missing materials");
 await page.keyboard.press("Escape");
 console.log("SANDBOX PASS legacy migration, finite safehouse loot and craft rollback");

 await walk(page,"x",-47);await walk(page,"z",-10.5);
 await walk(page,"x",-11);await walk(page,"z",-21);await walk(page,"x",-7);
 await open(page,"Market lower shelf");
 await page.getByRole("button",{name:"TAKE SUPPLIES"}).click();
 await page.keyboard.press("Escape");
 await page.keyboard.press("i");await page.locator("#craft-tab").click();
 await page.getByRole("button",{name:/CRAFT DOOR BRACE KIT/}).click();
 assert.match(await page.locator("#pack-status").textContent(),/Crafted Door brace kit/);
 await capture(page,"crafting");
 assert.equal((await save(page)).inventory.brace,1);
 await reload(page);
 assert.equal((await snap(page)).inventory.brace,1);
 await open(page,"Market lower shelf");
 assert.equal(await page.locator("#field-items button").count(),0);
 await page.keyboard.press("Escape");
 console.log("SANDBOX PASS traveled to the market, crafted a kit and reloaded both craft and loot history");

 await walk(page,"x",-11);await walk(page,"z",-10.5);
 await walk(page,"x",-47);await walk(page,"z",-16.5);
 await open(page,"Safehouse gate");
 await page.getByRole("button",{name:"INSTALL BRACE KIT"}).click();
 assert.match(await page.locator("#field-status").textContent(),/Braced.*installed/);
 await page.keyboard.press("Escape");
 await capture(page,"braced-gate");
 await walk(page,"z",-27.9);await walk(page,"x",-54);
 await open(page,"Safehouse locker");
 await page.getByRole("button",{name:/STORE CLOTH/}).click();
 assert.equal((await save(page)).sandbox.storage.cloth,1);
 await page.getByRole("button",{name:/TAKE CLOTH/}).click();
 assert.equal((await save(page)).sandbox.storage.cloth,0);
 await page.getByRole("button",{name:/STORE CLOTH/}).click();
 await reload(page);
 const final=await save(page);
 assert.equal(final.stage,legacy.stage);
 assert.equal(final.sandbox.brace,1);
 assert.equal(final.sandbox.storage.cloth,1);
 assert.equal(final.inventory.brace??0,0);
 await open(page,"Safehouse locker");await capture(page,"locker");
 console.log("SANDBOX PASS returned on foot, installed the brace, round-tripped storage and restored the shelter");
 await page.close();

 const mobile=await newFixture({...legacy,stage:0,x:-42,z:-24,hasGun:false,ammo:0,supplies:0},true);
 await mobile.locator("#mobile-interact").tap();
 assert.equal(await mobile.locator("#field-title").textContent(),"Safehouse footlocker");
 await mobile.getByRole("button",{name:"TAKE SUPPLIES"}).tap();
 assert.equal((await save(mobile)).sandbox.looted["safehouse-kit"],true);
 const card=await mobile.locator(".sandbox-panel").filter({has:mobile.locator("#field-title")}).boundingBox();
 assert(card&&card.x>=0&&card.x+card.width<=390,"Touch modal overflowed the viewport");
 await capture(mobile,"touch-scavenging");
 await mobile.locator("#close-field").tap();await mobile.close();
 console.log("SANDBOX PASS narrow touch viewport can search, claim and close");

 const encounter=await newFixture({...legacy,version:2,x:-11,z:-10.6,sandbox:{seed:42,looted:{"market-stock":true}}});
 await encounter.evaluate(()=>window.__ashfordQA.profile(true));
 for(let i=0;i<25;i++)await encounter.keyboard.press("q");
 await encounter.waitForFunction(()=>window.__ashfordQA.sandbox().active!==null,null,{timeout:55000});
 const active=(await save(encounter)).sandbox.active;
 assert.equal(active.id,"market");
 assert.equal(active.actors.length,2);
 await capture(encounter,"encounter");
 await reload(encounter);
 const restored=(await snap(encounter)).enemies.filter(actor=>actor.encounter==="market");
 assert.equal(restored.length,active.actors.length);
 assert(restored.every(actor=>actor.hp>0));
 for(let i=0;i<54;i++){
  const player=await snap(encounter);
  const actor=player.enemies.find(enemy=>enemy.encounter==="market"&&Math.hypot(enemy.x-player.x,enemy.z-player.z)<25);
  assert(actor,"No encounter member within firing range");
  const yaw=Math.atan2(-(actor.x-player.x),-(actor.z-player.z));
  const angle=Math.atan2(Math.sin(yaw-player.cameraYaw),Math.cos(yaw-player.cameraYaw));
  if(Math.abs(angle)<.12)break;
  await encounter.keyboard.press(angle>0?"q":"r");
 }
 const before=(await snap(encounter)).ammo;
 await encounter.keyboard.press("f");
 assert.equal((await snap(encounter)).ammo,before-1);
 await encounter.waitForFunction(()=>window.__ashfordQA.snapshot().enemies.filter(e=>e.encounter==="market").some(e=>e.hp<e.max)||
  window.__ashfordQA.snapshot().enemies.filter(e=>e.encounter==="market").length<2,null,{timeout:6000});
 await encounter.waitForFunction(()=>window.__ashfordQA.profile(true).simulation.samples>=12,null,{timeout:18000});
 const profile=await encounter.evaluate(()=>window.__ashfordQA.profile(false));
 assert(profile.simulation.samples>=12,"Encounter profiling produced no usable samples");
 await writeFile(resolve(artifacts,"v016-encounter-profile.json"),JSON.stringify(profile,null,2)+"\n");
 console.log("SANDBOX PASS two-member natural encounter, active checkpoint reload and real pistol hit");
 assert.deepEqual(errors,[]);
 await encounter.close();
}catch(error){
 console.error("SANDBOX BROWSER FAILED:",error.stack||error);process.exitCode=1;
}finally{
 await browser?.close();await new Promise(done=>server.close(done));
}
