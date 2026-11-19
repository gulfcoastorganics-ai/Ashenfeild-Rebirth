import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {extname, resolve, sep} from "node:path";
import {chromium} from "playwright";

const currentRoot=resolve(import.meta.dirname,"..");
const baselinePath=process.argv[2];
const setting=process.argv[3]??"performance";
const interiorsOnly=process.argv.includes("--indoors");
const actorsOnly=process.argv.includes("--actors");
const crowdOnly=process.argv.includes("--crowd");
const liveCombat=process.argv.includes("--live");
const fallbackModels=process.argv.includes("--fallback");
const frameCount=Number(process.env.ASHFORD_BENCHMARK_FRAMES??24);
if(!baselinePath||!["performance","balanced","quality"].includes(setting)||!Number.isInteger(frameCount)||frameCount<12||(liveCombat&&!crowdOnly))throw Error("Usage: node tests/compare-render.mjs <baseline checkout> [performance|balanced|quality] [--indoors|--actors|--crowd [--live]] [--fallback]");
const outputPath=resolve(currentRoot,"artifacts",`comparison-${setting}${interiorsOnly?"-indoors":actorsOnly?"-actors":crowdOnly?"-crowd":""}${fallbackModels?"-fallback":""}${liveCombat?"-live":""}`);
const viewport={width:1000,height:640};
const types={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css",".webp":"image/webp",".glb":"model/gltf-binary"};
const views=[
 {name:"safehouse",x:-48,z:-24,yaw:Math.PI,stage:0},
 {name:"market",x:-11,z:-26,yaw:0,stage:2},
 {name:"patrol",x:15,z:5.6,yaw:-.48,stage:4},
 {name:"clinic",x:44,z:-25.7,yaw:0,stage:6},
 {name:"survivor",x:-47,z:-17.8,yaw:Math.PI,facing:0,stage:0},
 {name:"infected", enemy:true}
];
const actors=[
 {name:"survivor",kind:"player",x:-47,z:-17.8,yaw:Math.PI,facing:0,stage:0},
 {name:"mara",kind:"mara",x:-12.1,z:-22.8,yaw:0,stage:2},
 {name:"vale",kind:"vale",x:49.4,z:-26.6,yaw:0,stage:6},
 {name:"guard",kind:"guard",x:40.7,z:-26.3,yaw:0,stage:6},
 ...["walker","runner","brute","spitter"].map(kind=>({name:kind,kind,enemy:true})),
];

async function serve(root){
 const server=createServer(async(req,res)=>{
  try{
   const {pathname}=new URL(req.url,"http://127.0.0.1");
   const file=resolve(root,"."+decodeURIComponent(pathname)+(pathname==="/"?"index.html":""));
   if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
   const data=await readFile(file);
   res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream"}).end(data);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 return server;
}

function stats(values){
 const sorted=[...values].sort((a,b)=>a-b);
 const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
 const percentile=p=>sorted[Math.ceil(values.length*p)-1];
 return {meanMs:mean,p50Ms:percentile(.5),p95Ms:percentile(.95),samples:values.length};
}

async function capture(browser,root,build){
 const server=await serve(root);
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 try{
  await page.addInitScript(({mode,fallback})=>{
   localStorage.setItem("ashfordGraphicsV02",mode);
   localStorage.setItem("ashfordAdaptiveCharacters","off");
   localStorage.setItem("ashfordDetailedCharacters",fallback?"off":"on");
   let seed=81329;
   Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   const request=window.requestAnimationFrame.bind(window);
   window.renderCallbackMs=[];
   window.requestAnimationFrame=callback=>{
    if(callback.name!=="animate")return request(callback);
    return request(timestamp=>{
     const started=performance.now();
     callback(timestamp);
     if(window.renderCallbackMs.length<1000)window.renderCallbackMs.push(performance.now()-started);
    });
   };
  },{mode:setting,fallback:fallbackModels});
  const started=Date.now();
  await page.goto("http://127.0.0.1:"+server.address().port+"/?__qa=1",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>Boolean(window.__ashfordQA));
  const sceneReadyMs=Date.now()-started;
  await page.locator("#start-button").click();
  await page.waitForFunction(mode=>{
   const {photoAssets}=window.__ashfordQA.perf();
   return !photoAssets||(photoAssets.colors===4&&(mode!=="quality"||photoAssets.detail===4));
  },setting,{timeout:30000});
  const renderer=await page.evaluate(()=>{
   const gl=document.querySelector("#game canvas").getContext("webgl2");
   const debug=gl.getExtension("WEBGL_debug_renderer_info");
   return gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER);
  });
  const samples=[];
  const crowd=[{name:"one-infected",kind:"runner",enemy:true},{name:"six-infected",kind:"runner",enemy:true,crowd:true}];
  for(const view of interiorsOnly?views.slice(0,2):actorsOnly?actors:crowdOnly?crowd:views){
   if(!view.enemy){
    await page.evaluate(({x,z,yaw,stage,facing=yaw})=>window.__ashfordQA.referenceView(x,z,yaw,stage,facing),view);
    if(view.name==="market")await page.waitForFunction(()=>{
     const current=window.__ashfordQA.perf();return !current.photoAssets||current.marketShelf;
    },null,{timeout:30000});
    // Park simulation after the HUD has caught up with the scripted viewpoint.
    await page.waitForTimeout(650);
   }
   await page.keyboard.press("Escape");
   await page.evaluate(()=>{document.querySelector("#pause-modal").style.visibility="hidden";});
   if(view.enemy)await page.evaluate(view=>{
    const qa=window.__ashfordQA;
    window.setupCombatBenchmark=()=>{
     qa.combatSetup(view.kind??"runner",4.6);
     if(view.crowd)for(const [index,kind] of ["walker","brute","spitter","runner","walker"].entries())qa.combatAdd(kind,5.2+index*.8);
    };
    window.setupCombatBenchmark();
   },view);
   if(!fallbackModels)await page.waitForFunction(view=>{
    const {characters}=window.__ashfordQA.perf();
    if(!characters)return true;
    const shown=kind=>characters.some(r=>r.kind===kind&&r.shown);
    return shown("player")&&(!view.kind||shown(view.kind))&&(view.name!=="market"||shown("mara"));
   },view,{timeout:30000});
   if(liveCombat)await page.keyboard.press("Escape");
   const windows=await page.evaluate(async({sampleCount,frameCount,liveCombat})=>{
    const next=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    for(let i=0;i<5;i++)await next();
    const windows=[];
    for(let sample=0;sample<sampleCount;sample++){
     if(liveCombat)window.setupCombatBenchmark();
     window.renderCallbackMs.length=0;
     const raf=[];
     let shots=0,effectFrames=0;
     let previous=await next();
     for(let i=0;i<frameCount;i++){
      if(liveCombat&&i%4===0){
       const before=window.__ashfordQA.snapshot().ammo;
       dispatchEvent(new KeyboardEvent("keydown",{code:"KeyF"}));
       dispatchEvent(new KeyboardEvent("keyup",{code:"KeyF"}));
       shots+=before-window.__ashfordQA.snapshot().ammo;
      }
      const timestamp=await next();
      raf.push(timestamp-previous);previous=timestamp;
      if(liveCombat&&window.__ashfordQA.perf().effects?.tracers)effectFrames++;
     }
     windows.push({raf,callbacks:window.renderCallbackMs.slice(1),shots,effectFrames});
    }
    return windows;
   },{sampleCount:interiorsOnly||crowdOnly?3:1,frameCount,liveCombat});
   const raf=windows.flatMap(w=>w.raf),callbacks=windows.flatMap(w=>w.callbacks);
   const render=await page.evaluate(()=>window.__ashfordQA.perf());
   assert.equal(render.pixelRatio,setting==="performance"?.85:1);
   assert(render.drawCalls>0&&render.triangles>0);
   await page.screenshot({path:resolve(outputPath,build+"-"+view.name+".png"),animations:"disabled"});
   const frame=stats(raf);
   const sample={view,drawCalls:render.drawCalls,triangles:render.triangles,geometries:render.geometries,
    textures:render.textures,activePointLights:render.pointLightsActive,pixelRatio:render.pixelRatio,
    visibleSkinnedActors:render.characters?.filter(actor=>actor.shown).length,
    fps:1000/frame.meanMs,frame,windows:windows.map(w=>({...stats(w.raf),shots:w.shots,effectFrames:w.effectFrames})),renderCallback:stats(callbacks),frameSamplesMs:raf};
   if(liveCombat)assert(windows.every(w=>w.shots>0),"Live combat sample did not fire the pistol");
   if(liveCombat&&build==="after")assert(windows.every(w=>w.effectFrames>0),"Live combat sample did not include visible effects");
   samples.push(sample);
   console.log(build,view.name,JSON.stringify({drawCalls:sample.drawCalls,triangles:sample.triangles,
    textures:sample.textures,fps:sample.fps,p95FrameMs:frame.p95Ms,p95CallbackMs:sample.renderCallback.p95Ms}));
   if(!liveCombat)await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors,[]);
  return {build,renderer,sceneReadyMs,views:samples};
 }finally{
  await page.close();
  await new Promise(done=>server.close(done));
 }
}

await mkdir(outputPath,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
 const before=await capture(browser,resolve(baselinePath),"before");
 const after=await capture(browser,currentRoot,"after");
 await writeFile(resolve(outputPath,"benchmarks.json"),JSON.stringify({viewport,graphics:setting,
  note:"Software rendering. Seeded world and matched views. "+(liveCombat?"Live simulation with scripted keyboard shots.":"Simulation paused during timing.")+" Frame pace and JS callbacks include any browser/driver blocking.",
  browser:browser.version(),before,after},null,2));
}finally{await browser.close();}
