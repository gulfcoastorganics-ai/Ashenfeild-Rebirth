import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {extname, resolve, sep} from "node:path";
import {chromium} from "playwright";

const currentRoot=resolve(import.meta.dirname,"..");
const baselinePath=process.argv[2];
const setting=process.argv[3]??"performance";
if(!baselinePath||!["performance","quality"].includes(setting))throw Error("Usage: node tests/compare-render.mjs <baseline checkout> [performance|quality]");
const outputPath=resolve(currentRoot,"artifacts",`comparison-${setting}`);
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
  await page.addInitScript(mode=>{
   localStorage.setItem("ashfordGraphicsV02",mode);
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
  },setting);
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
  for(const view of views){
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
   if(view.enemy)await page.evaluate(()=>window.__ashfordQA.combatSetup("runner",4.6));
   const {raf,callbacks}=await page.evaluate(async()=>{
    const next=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    for(let i=0;i<5;i++)await next();
    window.renderCallbackMs.length=0;
    const raf=[];
    let previous=await next();
    for(let i=0;i<24;i++){
     const timestamp=await next();
     raf.push(timestamp-previous);previous=timestamp;
    }
    return {raf,callbacks:window.renderCallbackMs.slice(1)};
   });
   const render=await page.evaluate(()=>window.__ashfordQA.perf());
   assert.equal(render.pixelRatio,setting==="performance"?.85:1);
   assert(render.drawCalls>0&&render.triangles>0);
   await page.screenshot({path:resolve(outputPath,build+"-"+view.name+".png"),animations:"disabled"});
   const frame=stats(raf);
   const sample={view,drawCalls:render.drawCalls,triangles:render.triangles,geometries:render.geometries,
    textures:render.textures,activePointLights:render.pointLightsActive,pixelRatio:render.pixelRatio,
    fps:1000/frame.meanMs,frame,renderCallback:stats(callbacks),frameSamplesMs:raf};
   samples.push(sample);
   console.log(build,view.name,JSON.stringify({drawCalls:sample.drawCalls,triangles:sample.triangles,
    textures:sample.textures,fps:sample.fps,p95FrameMs:frame.p95Ms,p95CallbackMs:sample.renderCallback.p95Ms}));
   await page.keyboard.press("Escape");
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
  note:"Software rendering. Seeded world, fixed views, simulation paused during timing. Frame pace and JS callbacks include any browser/driver blocking.",
  browser:browser.version(),before,after},null,2));
}finally{await browser.close();}
