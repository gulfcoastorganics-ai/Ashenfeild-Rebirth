import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
import {isBlocked as isBlocked2D,lineBlocked as hasCover,chaseGoal as chooseChaseGoal,findPath as findRoute,restoreCheckpoint,ENTRANCES} from "./nav.mjs";
import {WEAPONS,INFECTED,ATTACK_RANGE,SPIT_RANGE,chooseTarget,applyHit,chooseInfectedAction,attackStillValid} from "./combat.mjs";
import {DODGE,canDodge,normalize2D,summarizeFrames} from "./survival.mjs";
import {carBody,faceGeometry,floorboards,masonry,sidewalkTexture} from "./art.mjs";
import {createAudio} from "./audio.mjs";
import {createSky,lightPool,loadMaterials} from "./lighting.mjs";
import {createSurfaceLibrary} from "./surfaces.mjs";

/* Ashford Rebirth: wholly original reconstruction. Not recovered Sites v7.1 source. */
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const dist = (a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
// Cache immutable opaque PBR materials. Use matUnique for local textures/emissive changes.
const materialCache=new Map();
function mat(color,rough=.88,metal=0){
 const key=color+"|"+rough+"|"+metal;
 let material=materialCache.get(key);
 if(!material){material=new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});materialCache.set(key,material);}
 return material;
}
function matUnique(color,rough=.88,metal=0){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});}
function materialCacheHas(material){for(const item of materialCache.values()){if(item===material)return true;}return false;}
const coal=mat(0x21282a), asphalt=mat(0x292c2d), concrete=mat(0x555b57), dust=mat(0x7a7060), brick=mat(0x5f5551), panel=mat(0x6c726d), glass=mat(0x39595a,.25,.15), dark=mat(0x1b2225);
const goldMat=new THREE.MeshStandardMaterial({color:0xf1b775,emissive:0x9d5723,emissiveIntensity:.5,roughness:.3});
const scene=new THREE.Scene();
const skyTexture=createSky();
const performanceSky=new THREE.Color(0x565952);
scene.background=skyTexture;
scene.backgroundIntensity=.84;
scene.fog=new THREE.FogExp2(0x746f60,.017);
let materialTile;
const surfaces=createSurfaceLibrary();
let fineSurfaces=true,sceneGrade=true,gradeZone,marketShelf=null,marketShelfRequested=false;
const sceneGrades={
 neutral:{exposure:1.21,sky:0xacbcc9,ground:0x544732},
 street:{exposure:1.14,sky:0xa8bcc7,ground:0x504b40},
 safehouse:{exposure:1.27,sky:0xc2bdb3,ground:0x564334},
 market:{exposure:1.23,sky:0xb8c6b9,ground:0x5e4939},
 clinic:{exposure:1.28,sky:0xa4c5d2,ground:0x434f47}
};
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,210);
function createRenderer(){
 try{return new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});}
 catch{
  $("loader").remove();
  $("start-button").disabled=true;
  $("startup-status").textContent="3D rendering is unavailable. Enable WebGL and graphics acceleration, then reload.";
  $("startup-status").hidden=false;
  const retry=$("retry-button");
  retry.hidden=false;retry.onclick=()=>location.reload();
  return null;
 }
}
const renderer=createRenderer();
if(!renderer)throw new Error("WebGL unavailable");
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.21;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$("game").appendChild(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xacbcc9,0x544732,1.34);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xffd8ab,1.92);moon.position.set(-34,32,42);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-70;moon.shadow.camera.right=70;moon.shadow.camera.top=60;moon.shadow.camera.bottom=-60;moon.shadow.bias=-.0003;moon.shadow.normalBias=.037;scene.add(moon,moon.target);
const world=new THREE.Group();scene.add(world);
const obstacles=[],enemies=[],effects=[],localLights=[],streetDetails=[],finishMaterials=[];
let lightBudgetElapsed=0;
let playerVisual,playerShadow,marker,markerRing,markerDiamond;
const sound=createAudio();
const tone=sound.tone;
let stepTravel=0,leftStep=false,viewSprint=0,playerSprint=false;
let cameraMotion=!matchMedia("(prefers-reduced-motion: reduce)").matches;
const state={
 started:false,paused:true,ended:false,stage:0,health:100,stamina:100,thirst:80,hunger:80,
 ammo:0,mag:12,hasGun:false,supplies:0,kills:0,waveKills:0,waveStarted:false,waveTimer:0,
 x:-48,z:-24,angle:Math.PI,weapon:"crowbar",inventory:{water:1,food:2,bandage:1},
 time:0,attackTime:0,shootTime:0,hitTime:0,lastSave:0,hitConfirm:0,cameraKick:0,meleeAnim:0,pistolAnim:0,dodgeTime:0,dodgeCooldown:0,dodgeIFrames:0,dodgeDir:{x:0,z:0}
};
const stages=[
 {title:"Exit the barricaded house",desc:"Make your way outside. The street is quiet—too quiet.",point:{x:-47,z:-11},kind:"arrive",radius:2.4},
 {title:"Find Last Stop Market",desc:"Search the storefront for survivors and supplies.",point:{x:-11,z:-15},kind:"arrive",radius:5},
 {title:"Speak with Mara",desc:"Find Mara behind the counter inside Last Stop Market.",point:{x:-14,z:-25},kind:"interact",name:"MARA"},
 {title:"Collect the emergency supplies",desc:"The supply crate is in the back aisle. Take what you can carry.",point:{x:-7,z:-29},kind:"interact",name:"SUPPLY CACHE"},
 {title:"Search the patrol car",desc:"A sidearm may still be inside the abandoned police cruiser.",point:{x:17,z:3},kind:"interact",name:"PATROL CAR"},
 {title:"Reach Ashford Clinic",desc:"Follow the road east. Find the clinic entrance.",point:{x:44,z:-15},kind:"arrive",radius:6},
 {title:"Find Dr. Vale",desc:"The last medic is sheltering in the rear ward.",point:{x:48,z:-28},kind:"interact",name:"DR. VALE"},
 {title:"Hold back the infected",desc:"Protect the clinic. Defeat four infected during the assault.",point:{x:45,z:-13},kind:"combat"},
 {title:"Secure the clinic entrance",desc:"Return to the front doors and secure the clinic gate.",point:{x:44,z:-15},kind:"interact",name:"CLINIC GATE"}
];
const keys={},touch={x:0,y:0,sprint:false};
let cameraYaw=Math.PI,cameraPitch=.39,lastPointer=null,activeDialog=false;
const graphicsModes=["auto","performance","balanced","quality"];
const graphicsPresets={
 performance:{pixelRatio:.85,shadows:false,particles:false},
 balanced:{pixelRatio:1,shadows:true,particles:true},
 quality:{pixelRatio:1.6,shadows:true,particles:true}
};
let qualityMode="auto",renderTier="balanced",qualityFrames=0,qualitySeconds=0;
let dustParticles;
let gaitPhase=0,gaitBlend=0;
const solidMeshes=[];
const cameraRay=new THREE.Raycaster();
const cameraPivot=V(0,0,0),cameraDesired=V(0,0,0),cameraDirection=V(0,0,0),cameraLook=V(0,0,0),cameraHits=[];
const fieldFlashlight=new THREE.SpotLight(0xe0e6c4,4.2,24,Math.PI/6,.52,1.8);
fieldFlashlight.castShadow=false;fieldFlashlight.visible=false;scene.add(fieldFlashlight);
const fieldFlashlightTarget=new THREE.Object3D();scene.add(fieldFlashlightTarget);
fieldFlashlight.target=fieldFlashlightTarget;
let flashlightOn=false;
function toggleFlashlight(){
 if(!state.started||state.ended)return;
 flashlightOn=!flashlightOn;
 fieldFlashlight.visible=flashlightOn;
 $("light-button").setAttribute("aria-pressed",String(flashlightOn));
 $("light-button").textContent=flashlightOn?"LIGHT ON":"LIGHT";
 tone(flashlightOn?410:200,.055,"triangle",.04);
}


const pos=()=>({x:state.x,z:state.z});
function mesh(geom,material,x=0,y=0,z=0,group=world){const m=new THREE.Mesh(geom,material);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m}
const unitCube=new THREE.BoxGeometry(1,1,1);
const unitSphere=new THREE.SphereGeometry(1,10,8);
const canopyGeometry=new THREE.SphereGeometry(1,7,5);
const unitCylinder=new THREE.CylinderGeometry(1,1,1,9);
function box(x,y,z,w,h,d,material,solid=false,group=world){const m=mesh(unitCube,material,x,y,z,group);m.scale.set(w,h,d);m.castShadow=h>.45;if(solid){obstacles.push({x,z,w,d});solidMeshes.push(m);}return m}
function instanced(count,material,transform,geometry=unitCube){
 const group=new THREE.InstancedMesh(geometry,material,count);
 const dummy=new THREE.Object3D();
 for(let i=0;i<count;i++){
  const data=transform(i);
  dummy.position.set(data.x,data.y,data.z);
  dummy.scale.set(data.w,data.h,data.d);
  dummy.rotation.set(data.rx||0,data.rot||0,data.rz||0);
  dummy.updateMatrix();group.setMatrixAt(i,dummy.matrix);
 }
 group.instanceMatrix.needsUpdate=true;group.castShadow=false;group.receiveShadow=false;
 world.add(group);return group;
}
function instancedByRegion(items,material,geometry=unitCube){
 const regions=new Map();
 for(const item of items){
  const key=Math.floor(item.x/36)+":"+Math.floor(item.z/36);
  if(!regions.has(key))regions.set(key,[]);
  regions.get(key).push(item);
 }
 for(const entries of regions.values())instanced(entries.length,material,i=>entries[i],geometry);
}
function batchStaticProps(parent=world){
 const collisionMeshes=new Set(solidMeshes);
 const batches=new Map();
 for(const prop of parent.children){
  if(!prop.isMesh||prop.isInstancedMesh||!prop.visible||prop.material.transparent||collisionMeshes.has(prop))continue;
  const {geometry,material,position,castShadow,receiveShadow}=prop;
  const key=[geometry.id,material.id,castShadow,receiveShadow,Math.floor(position.x/32),Math.floor(position.z/32)].join(":");
  if(!batches.has(key))batches.set(key,[]);
  batches.get(key).push(prop);
 }
 for(const props of batches.values()){
  if(props.length<2)continue;
  const first=props[0];
  const batch=new THREE.InstancedMesh(first.geometry,first.material,props.length);
  batch.castShadow=first.castShadow;
  batch.receiveShadow=first.receiveShadow;
  props.forEach((prop,index)=>{
   prop.updateMatrix();
   batch.setMatrixAt(index,prop.matrix);
  });
  batch.computeBoundingSphere();
  parent.remove(...props);
  parent.add(batch);
 }
}
function cyl(x,y,z,r,depth,material,group=world){const m=mesh(unitCylinder,material,x,y,z,group);m.scale.set(r,depth,r);m.castShadow=true;return m}
function sphere(x,y,z,r,material,group=world){const m=mesh(unitSphere,material,x,y,z,group);m.scale.setScalar(r);m.castShadow=true;return m}
function addLight(x,y,z,color,intensity,distance){const l=new THREE.PointLight(color,intensity,distance,2);l.position.set(x,y,z);world.add(l);localLights.push(l);return l;}
function updateLightBudget(){
 const facadeRange=renderTier==="performance"?37:renderTier==="balanced"?57:90;
 // Track the nearby scene in Balanced so distant casters stay out of the shadow pass.
 const offsetX=renderTier==="balanced"?Math.round(state.x/4)*4:0;
 const offsetZ=renderTier==="balanced"?Math.round(state.z/4)*4:0;
 moon.target.position.set(offsetX,0,offsetZ);
 moon.position.set(offsetX-34,32,offsetZ+42);
 for(const {x,z,group} of streetDetails)group.visible=Math.hypot(x-state.x,z-state.z)<facadeRange;
 for(const l of localLights){
  const limit=Math.max(24,l.distance+12);
  l.visible=Math.hypot(l.position.x-state.x,l.position.z-state.z)<limit;
 }
 const nearMarket=Math.hypot(state.x+11,state.z+26)<29;
 if(marketShelf)marketShelf.visible=nearMarket;
 if(nearMarket&&!marketShelfRequested){
  marketShelfRequested=true;
  void loadMarketShelf();
 }
}

async function loadMarketShelf(){
 try{
  const {GLTFLoader}=await import("./vendor/loaders/GLTFLoader.js");
  const {scene:model}=await new GLTFLoader().loadAsync(new URL("../assets/market-shelf.glb",import.meta.url).href);
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  const dimensions=bounds.getSize(new THREE.Vector3());
  if(bounds.isEmpty()||!Number.isFinite(dimensions.y)||dimensions.y<=0)return;
  const center=bounds.getCenter(new THREE.Vector3());
  const scale=Math.min(2.65/dimensions.y,1.9/Math.max(dimensions.x,dimensions.z));
  model.scale.setScalar(scale);
  model.position.set(-10.25-center.x*scale,.071-bounds.min.y*scale,-36.65-center.z*scale);
  model.traverse(node=>{if(node.isMesh){node.receiveShadow=true;node.castShadow=false;}});
  model.visible=Math.hypot(state.x+11,state.z+26)<29;
  marketShelf=model;
  world.add(model);
 }catch{}
}
function label(text,w=9,h=1.9,bg="#121a1c",fg="#e3c18b",size=50){
 const c=document.createElement("canvas");c.width=1024;c.height=256;const ctx=c.getContext("2d");ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);
 ctx.strokeStyle="#a67b51";ctx.lineWidth=9;ctx.strokeRect(11,11,1002,234);
 ctx.fillStyle=fg;ctx.font="bold "+size+"px Georgia, serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,512,125,940);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.FrontSide}));
}
function gritTexture(){
 const c=document.createElement("canvas");c.width=c.height=256;
 const ctx=c.getContext("2d");ctx.fillStyle="#444749";ctx.fillRect(0,0,256,256);
 for(let i=0;i<3200;i++){
  const x=Math.random()*256,y=Math.random()*256,r=Math.random()*1.8+.25;
  const shade=Math.random()>.52?"rgba(152,145,134,.16)":"rgba(0,0,0,.18)";
  ctx.fillStyle=shade;ctx.fillRect(x,y,r,r);
 }
 for(let i=0;i<10;i++){
  const x=rand(0,256),y=rand(0,256);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand(-30,30),y+rand(-20,20));
  ctx.strokeStyle="rgba(13,15,15,.32)";ctx.lineWidth=rand(.25,1.1);ctx.stroke();
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(13,2);
 tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 return tex;
}
function wall(x,z,w,d,h,material=brick){return box(x,h/2,z,w,h,d,material,true)}
function floor(x,z,w,d,material){return box(x,.025,z,w,.05,d,material)}
function referenceClinicFloor(){
 const c=document.createElement("canvas");c.width=c.height=512;
 const ctx=c.getContext("2d");
 let seed=0x8173a21;const noise=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 const size=256;
 for(let row=0;row<2;row++)for(let col=0;col<2;col++){
  const x=col*size,y=row*size,light=(col+row)%2===0;
  ctx.fillStyle=light?(row===0?"#aca395":"#a19a8d"):(row===0?"#595b57":"#525454");ctx.fillRect(x,y,size,size);
  const wear=ctx.createRadialGradient(x+88,y+110,4,x+88,y+110,173);
  wear.addColorStop(0,"rgba(185,169,143,.22)");wear.addColorStop(.63,"rgba(124,108,89,.07)");wear.addColorStop(1,"rgba(33,31,27,.23)");
  ctx.fillStyle=wear;ctx.fillRect(x,y,size,size);
  ctx.fillStyle="rgba(21,24,21,.67)";ctx.fillRect(x,y,3,size);ctx.fillRect(x,y,size,3);
  ctx.fillStyle="rgba(213,207,187,.18)";ctx.fillRect(x+4,y+4,1,size-7);ctx.fillRect(x+4,y+4,size-7,1);
  for(let k=0;k<1700;k++){
   const px=x+noise()*size,py=y+noise()*size;
   ctx.fillStyle=noise()>.56?"rgba(30,33,29,.16)":"rgba(216,204,178,.12)";
   const l=.3+noise()*5;ctx.fillRect(px,py,l,l*(.2+noise()));
  }
  for(let k=0;k<11;k++){
   const px=x+noise()*size,py=y+noise()*size;
   ctx.strokeStyle="rgba(21,24,21,.12)";ctx.lineWidth=.5+noise()*2;
   ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+(noise()-.5)*26,py+(noise()-.5)*20);ctx.stroke();
  }
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(31/3.6,26/3.6);
 t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 return t;
}
function interiorFloorTexture(w,d,theme="safehouse"){
 const c=document.createElement("canvas");c.width=c.height=128;
 const ctx=c.getContext("2d");ctx.fillStyle=theme==="clinic"?"#7b8581":theme==="market"?"#675b49":"#55534b";ctx.fillRect(0,0,128,128);
 for(let i=0;i<13;i++){const v=i*(theme==="clinic"?10:theme==="market"?16:10);ctx.strokeStyle="rgba(20,24,23,.24)";
  ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,128);ctx.moveTo(0,v);ctx.lineTo(128,v);ctx.stroke();}
 for(let i=0;i<350;i++){ctx.fillStyle=i%3===0?"rgba(179,167,142,.17)":"rgba(19,27,27,.18)";
  ctx.fillRect(rand(0,128),rand(0,128),rand(.3,2.8),rand(.3,1.5));}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(w/8,d/8);return t;
}
function proceduralSurface(base,seed=1,repeatX=2,repeatY=1){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=256;
 const ctx=canvas.getContext("2d");ctx.fillStyle="#"+base.toString(16).padStart(6,"0");ctx.fillRect(0,0,256,256);
 let v=seed>>>0;const random=()=>{v=(Math.imul(1664525,v)+1013904223)>>>0;return v/4294967296;};
 for(let i=0;i<950;i++){
  const x=random()*256,y=random()*256;
  ctx.fillStyle=i%3===0?"rgba(25,28,27,.17)":"rgba(213,203,183,.08)";
  ctx.fillRect(x,y,.3+random()*4,.5+random()*13);
 }
 for(let i=0;i<35;i++){
  const x=random()*256,y=random()*256;
  ctx.strokeStyle="rgba(19,28,29,.25)";ctx.lineWidth=.4+random();
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*16,y+(random()-.5)*34);ctx.stroke();
 }
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 return t;
}
function wornSurface(base,seed=1,x=2,y=1){return new THREE.MeshStandardMaterial({map:proceduralSurface(base,seed,x,y),roughness:.95});}
function house({cx,cz,w,d,frontGap=6,color=brick,doorX=cx,back=true,theme="safehouse"}){
 const backZ=cz-d/2,frontZ=cz+d/2,left=cx-w/2,right=cx+w/2;
 const hardwood=theme==="safehouse"?detailedMaterial(0,0,w/7,d/4.9,0xe3dbc7,.80,.036):null;
 const tile=hardwood??matUnique(0xffffff);
 if(!hardwood)tile.map=theme==="clinic"?referenceClinicFloor():theme==="safehouse"?floorboards(w,d):interiorFloorTexture(w,d,theme);
 if(theme==="safehouse")surfaces.register("wood_floor_worn",tile,w/3.7,d/3.7,0xc2b6a2,.61);
 else surfaces.register("interior_tiles",tile,w/3.8,d/3.8,theme==="clinic"?0xa0b4b3:0xb8aa8d,.59);
 // Lift interior finish above the base world ground to eliminate coplanar depth fighting.
 box(cx,.057,cz,w,.028,d,tile);
 if(back)wall(cx,backZ,w,.7,4.9,color);
 wall(left,cz,.7,d,4.9,color);wall(right,cz,.7,d,4.9,color);
 if(doorX-frontGap/2>left)wall((left+doorX-frontGap/2)/2,frontZ,doorX-frontGap/2-left,.7,4.9,color);
 if(doorX+frontGap/2<right)wall((right+doorX+frontGap/2)/2,frontZ,right-(doorX+frontGap/2),.7,4.9,color);
 box(cx,4.85,backZ+.35,w,.23,.35,dark);
 return {frontZ,backZ,left,right};
}
function detailedMaterial(column,row,repeatX,repeatY,color,roughness,relief){
 const map=materialTile?.({column,row,repeatX,repeatY});
 if(!map)return null;
 const material=new THREE.MeshStandardMaterial({map,color,roughness});
 finishMaterials.push({material,map,relief});
 return material;
}
function windowPanel(x,y,z,w,h,pane=glass){box(x,y,z,w,h,.1,pane);box(x-w/2,y,z,.13,h+.2,.14,dark);box(x+w/2,y,z,.13,h+.2,.14,dark);box(x,y+h/2,z,w+.1,.13,.14,dark);box(x,y-h/2,z,w+.1,.13,.14,dark);}
function marketWindowMaterial(){
 const map=proceduralSurface(0x254044,512,1,1);
 const ctx=map.image.getContext("2d");
 const grime=ctx.createLinearGradient(0,90,0,255);
 grime.addColorStop(0,"rgba(165,146,110,0)");
 grime.addColorStop(1,"rgba(165,146,110,.65)");
 ctx.fillStyle=grime;ctx.fillRect(0,0,256,256);
 ctx.fillStyle="rgba(158,191,183,.15)";
 ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(90,0);ctx.lineTo(235,256);ctx.lineTo(159,256);ctx.fill();
 ctx.lineWidth=1.2;ctx.strokeStyle="rgba(197,201,179,.52)";
 ctx.beginPath();ctx.moveTo(171,96);ctx.lineTo(157,117);ctx.lineTo(169,146);ctx.lineTo(162,165);ctx.moveTo(157,117);ctx.lineTo(131,113);
 ctx.moveTo(157,117);ctx.lineTo(158,87);ctx.lineTo(146,60);ctx.moveTo(157,117);ctx.lineTo(183,119);ctx.lineTo(203,105);ctx.stroke();
 return new THREE.MeshStandardMaterial({map,roughness:.48,metalness:.15});
}
function parcelMaterial(){
 const map=proceduralSurface(0x9d805c,608,1,1);
 const ctx=map.image.getContext("2d");
 ctx.fillStyle="rgba(63,44,27,.54)";ctx.fillRect(118,0,24,256);
 ctx.fillStyle="rgba(196,165,118,.55)";ctx.fillRect(122,0,15,256);
 ctx.fillStyle="#aaa18c";ctx.fillRect(151,39,78,57);
 ctx.fillStyle="#4b4639";ctx.font="bold 12px sans-serif";ctx.fillText("DRY GOODS",158,55);
 for(let i=0;i<16;i++)ctx.fillRect(159+i*4,69,1+(i%3===0),13);
 ctx.fillStyle="rgba(75,58,40,.55)";ctx.fillRect(4,5,248,3);ctx.fillRect(4,248,248,3);
 return new THREE.MeshStandardMaterial({map,roughness:.93});
}
function clinicCeiling(){
 const ceiling=wornSurface(0x464940,155,5,4);
 const underside=mesh(new THREE.PlaneGeometry(30.2,25.4),ceiling,45,4.91,-26);
 underside.rotation.x=Math.PI/2;
 const runners=mat(0x272d27,.88);
 for(const z of [-17,-24,-31,-38])box(45,4.82,z,29.7,.12,.16,runners);
 const canvas=document.createElement("canvas");canvas.width=canvas.height=64;
 const context=canvas.getContext("2d");
 const wash=context.createRadialGradient(32,32,3,32,32,31);
 wash.addColorStop(0,"rgba(188,208,161,.67)");wash.addColorStop(.5,"rgba(156,182,139,.23)");wash.addColorStop(1,"rgba(156,182,139,0)");
 context.fillStyle=wash;context.fillRect(0,0,64,64);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const spill=mesh(new THREE.PlaneGeometry(9.3,2.6),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),45,4.897,-30.05);
 spill.rotation.x=Math.PI/2;spill.receiveShadow=false;
}
function ceilingPanel(x,z,width,depth,tint){
 const ceiling=mesh(new THREE.PlaneGeometry(width,depth),tint,x,4.91,z);
 ceiling.rotation.x=Math.PI/2;
}
function dressSafehouse(){
 const plaster=detailedMaterial(1,0,4,1,0xa6a18c,.94,.045)??masonry("#706c59",574,5,1);
 const stud=mat(0x534134),timber=detailedMaterial(0,0,2,1,0x9b876d,.86,.023)??masonry("#654c38",588,2,1);
 surfaces.register("painted_plaster_wall",plaster,5,1.2,0x9a907c,.67);
 surfaces.register("wood_floor_worn",timber,1.6,1,0x93765a,.56);
 ceilingPanel(-49,-26,24.4,22.4,plaster);
 for(const z of [-33,-25,-17])box(-49,4.76,z,24.5,.24,.23,stud);
 box(-49,2.43,-37.10,24.25,4.78,.04,plaster);
 for(const x of [-61.12,-36.88]){
  box(x,2.43,-26,.04,4.78,22.27,plaster);
  box(x,.56,-26,.08,.18,22.2,stud);
 }
 // Fixed debris and furniture stay against the walls, clear of the exit route.
 const block=mat(0x4a4437),fabric=masonry("#666451",608,1,1);
 for(const x of [-59,-55,-41,-38.4])box(x,.59,-36.16,2.26,1.05,1.2,timber);
 for(const [x,z] of [[-56.8,-31.8],[-40.6,-35],[-43,-32.8]]){
  const crate=box(x,.37,z,1.1,.62,.85,block);crate.rotation.y=.28;
  const lid=box(x,.69,z,1.15,.075,.88,stud);lid.rotation.y=.28;
 }
 box(-54,.98,-30,2.7,.28,1.45,fabric);
 box(-54,1.17,-30.42,2.4,.11,.51,mat(0x8e8268));
 const blanket=box(-53.2,1.16,-29.84,.84,.14,.9,mat(0x6b5947));blanket.rotation.y=-.13;
 for(const x of [-53.2,-52,-50.8,-44.9,-43.7,-42.5]){
  box(x,2.09,-14.22,.12,4,.18,stud);
 }
 for(const x of [-51.19,-42.81])for(const y of [1.35,2.42,3.43]){
  const board=box(x,y,-14.04,1.44,.22,.12,timber);board.rotation.z=(Math.round(y*10)%2?.12:-.16);
 }
 box(-47,4.26,-14.39,7.52,.26,.42,stud);
 for(const x of [-50.61,-43.39])box(x,2.21,-14.38,.17,4.35,.38,stud);
 // Dress the opening sightline while keeping the full doorway walkable.
 const blackened=mat(0x272c2b,.78),canvas=mat(0x82765a),iron=mat(0x655d4e,.55,.2);
 box(-53.1,.86,-17.5,2.51,1.46,.92,timber);
 box(-53.1,1.63,-17.5,2.61,.11,1.02,stud);
 for(const x of [-53.91,-53.1,-52.29]){
  box(x,1.05,-17.98,.712,.69,.08,timber);
  box(x,1.23,-18.029,.19,.05,.052,iron);
 }
 const toolbox=box(-53.57,1.83,-17.52,.66,.27,.43,blackened);
 toolbox.rotation.y=.14;
 const rag=box(-52.59,1.711,-17.44,.58,.028,.39,canvas);
 rag.rotation.y=-.17;
 box(-41.65,.54,-18.13,2.03,1.07,1.19,timber);
 box(-41.65,1.095,-18.13,2.12,.12,1.27,stud);
 for(const x of [-42.09,-41.44]){
  box(x,.63,-18.746,.075,.94,.023,iron);
  box(x,.93,-18.767,.101,.065,.032,blackened);
 }
 box(-41.43,1.37,-18.29,.68,.39,.417,canvas);
 const floorWash=mesh(new THREE.PlaneGeometry(6.45,9.7),lightPool(),-46.93,.078,-17.92);
 floorWash.rotateX(-Math.PI/2);floorWash.rotateZ(.22);
 floorWash.receiveShadow=false;
 attachContactShadow(world,-53.1,-17.5,.082,3.44,1.78);
 attachContactShadow(world,-41.65,-18.1,.083,2.87,1.82);
 const frame=mat(0x49433a,.65,.36),bedding=wornSurface(0x766c51,646,2,1);
 box(-58.7,.44,-21.1,1.5,.12,3.5,frame);
 box(-58.7,.57,-21.1,1.42,.20,3.37,bedding);
 box(-58.7,.70,-22.33,1.06,.12,.67,mat(0xa59b80));
 for(const z of [-22.6,-19.6])box(-58.7,.26,z,1.38,.42,.1,frame);
 attachContactShadow(world,-58.7,-21.1,.081,1.9,3.9);
}
function dressStreet(){
 const masonryA=masonry("#65544a",707,4,2,true),masonryB=masonry("#6b685b",708,4,1),roof=mat(0x383d38),sill=mat(0x55483a),window=mat(0x28363a,.35,.22);
 const buildings=[[-66,29,13,11,5.6],[-48,21,15,12,5.2],[-29,23,14,12,6.8],[-9,27,16,13,5.9],[11,27,13,12,6.4],[31,23,17,11,5.1],[54,28,18,12,6.9],[70,24,10,12,4.9]];
 for(const [i,[x,z,w,d,h]] of buildings.entries()){
  const facade=z-d/2-.05;
  box(x,h/2,z,w,h,d,i%2?masonryA:masonryB,true);
  box(x,h+.04,z,w+.6,.23,d+.55,roof);
  const detail=new THREE.Group();
  world.add(detail);streetDetails.push({x,z:facade,group:detail});
  box(x,3.16,facade,w+.1,.18,.21,sill,false,detail);
  box(x,1.37,facade-.02,1.45,2.67,.18,roof,false,detail);
  for(const offset of [-.29,.29]){
   box(x+w*offset,2.04,facade,2.3,1.61,.075,window,false,detail);
   box(x+w*offset,1.23,facade-.04,2.52,.11,.15,sill,false,detail);
  }
  batchStaticProps(detail);
 }
 // Outside the playable yards a second row breaks up the flat skyline.
 for(const [x,w,h] of [[-56,25,9],[-21,17,10],[9,20,8],[38,22,11],[67,17,7]]){
  box(x,h/2,48,w,h,9,mat(0x565954),true);
  box(x,h+.05,47.2,w+.5,.26,9.25,roof);
 }
 const stains=Array.from({length:42},(_,i)=>{
  const x=-70+i*3.42,z=i%2===0?-7.53:7.53;
  return {x,y:.061,z,w:.57+(i%5)*.28,h:.008,d:.22+(i%3)*.11,rot:(i%4)*.11};
 });
 instancedByRegion(stains,mat(0x312e28));
 const leaves=Array.from({length:48},(_,i)=>({
  x:-70+(i*23%143),z:(i%2?1:-1)*(8.07+(i%3)*.29),y:.11,w:.26+(i%5)*.06,h:.25+(i%7)*.05,d:1,
  rot:i*.41,rz:(i%3-.9)*.28
 }));
 const weeds=matUnique(0x52563a);weeds.side=THREE.DoubleSide;
 instancedByRegion(leaves,weeds,new THREE.CircleGeometry(1,3));
}
function makeWorld(){
 // Use the material sheet when available and a local procedural texture as fallback.
 const road=detailedMaterial(0,1,27,3,0xc9cac5,.78,.034)??asphalt;
 if(road===asphalt){asphalt.map=gritTexture();asphalt.color.set(0xffffff);}
 road.needsUpdate=true;
 surfaces.register("asphalt_02",road,55,6,0xc9c5b4,.47);
 // Terrain sits below the road and sidewalk to keep their textures stable.
 box(0,-.039,0,160,.076,140,mat(0x343d36));
 // Asphalt, sidewalk, gutters, and lane paint
 const sidewalk=new THREE.MeshStandardMaterial({map:sidewalkTexture(),roughness:.96});
 floor(0,0,145,16,road);floor(0,-10,145,4,sidewalk);floor(0,10,145,4,sidewalk);
 dressStreet();
 box(0,.08,-8,145,.17,.32,dust);box(0,.08,8,145,.17,.32,dust);
 instanced(15,mat(0xc7b48b),i=>({x:-66+i*9,y:.063,z:0,w:4,h:.018,d:.15}));
 // worn asphalt seam lines and cracks
 const cracks=Array.from({length:155},()=>({x:rand(-69,69),y:.066,z:rand(-7.6,7.6),w:rand(.24,1.9),h:.012,d:.025,rot:rand(-1.1,1.1)}));
 instancedByRegion(cracks,mat(0x171a1a));
 for(const shade of [0x6e6c5c,0x373d39,0x444b46])
  instanced(35,mat(shade),()=>{const size=rand(.09,.44);return {x:rand(-68,68),y:.07,z:rand(-46,39),w:size,h:.045,d:size};});
 instanced(17,mat(0x202d31,.19,.22),()=>({
  x:rand(-61,64),y:.066,z:rand(-6.4,6.4),
  w:rand(.25,1.5),h:rand(.18,.7),d:1,rx:-Math.PI/2
 }),new THREE.CircleGeometry(1,20));
 // Safehouse
 house({cx:-49,cz:-26,w:25,d:23,frontGap:7,doorX:-47,color:detailedMaterial(1,0,5,2,0x797365,.94,.032)??masonry("#625745",121,6,2,true),theme:"safehouse"});
 dressSafehouse();
 const hSign=label("SAFEHOUSE // 01",8,1.35,"#343332","#cbb79a",56);hSign.position.set(-49,4.4,-13.60);world.add(hSign);
 const safeLamp=box(-49,4.73,-19.2,1.9,.13,.38,matUnique(0xf3d7a3));
 safeLamp.material.emissive=new THREE.Color(0xf2b977);safeLamp.material.emissiveIntensity=.45;
 addLight(-46.5,4.23,-20.9,0xffc988,26,18);
 box(-54,.62,-30,3,1.2,2,dark,true);box(-40,.6,-32,1.8,1.1,1.6,mat(0x6a5844));
 windowPanel(-56,2.45,-14.32,2.9,1.9);
 for(let i=0;i<3;i++)box(-56+i*.8,2.5,-14.1,.1,2.4,.12,mat(0x6a5842));
 box(-47,2.3,-13.65,5.8,3.9,.12,mat(0x343c39,.95),false).visible=false;
 // market
 const marketWall=surfaces.register("painted_plaster_wall",masonry("#625548",229,6,2,true),5.3,1.3,0x9e927d,.55);
 house({cx:-11,cz:-26,w:26,d:24,frontGap:9,doorX:-11,color:marketWall,theme:"market"});
 ceilingPanel(-11,-26,25.4,23.4,masonry("#4d5145",213,4,4));
 const marketSign=label("LAST STOP MARKET",19,2.2,"#2d3534","#dfaa6d",78);marketSign.position.set(-11,4.35,-13.56);world.add(marketSign);
 const marketPane=marketWindowMaterial();
 for(const x of [-20,-2]){
  windowPanel(x,2.25,-13.55,4,2.4,marketPane);
  box(x,2.25,-13.55,.10,2.4,.15,dark);
  box(x,1.78,-13.55,4,.09,.15,dark);
 }
 box(-11,3.15,-13.47,9,.07,.05,mat(0x715f4c));
 // Worn panels and improvised shop notes establish detail at player height.
 for(const [x,z] of [[-21,-23],[-21,-34],[-1,-31]]){
   box(x,1.55,z,.08,1.35,1.3,mat(0x6e6455));
   box(x+.08,2.1,z,.035,.12,1.05,mat(0x9c8060));
 }
 // counter, cash register, shelves, stock
 box(-15,.82,-29,7,1.65,1.25,wornSurface(0x594734,637,2,1));box(-15,1.7,-29,7,.14,1.35,mat(0x88745c));
 for(const x of [-17.3,-15,-12.7])box(x,.88,-28.34,2.17,1.15,.065,mat(0x514034));
 box(-15,.27,-28.29,6.85,.11,.09,mat(0x252b29));
 box(-12,1.93,-29,1.1,.45,.85,dark);box(-12,2.16,-29,.9,.09,.48,glass);
 const stockColors=[0x7f6651,0x607a71,0x958456,0x444f5d],stockGroups=stockColors.map(()=>[]);
 for(let x of [-6,-2,0]){if(x===0)continue;
  for(let z of [-34,-27,-21]){if(x===-6 && z===-27)continue;
   for(const offset of [-1.42,1.42])for(const side of [-.59,.59])box(x+side,1.02,z+offset,.07,1.94,.075,coal);
   box(x,.99,z,.08,1.42,2.84,mat(0x56534b));
   for(let row=0;row<3;row++){box(x,1.68-row*.55,z,1.5,.12,3.12,mat(0x6a6554));
    for(let k=0;k<4;k++)stockGroups[(row+k)%4].push({
      x:x+rand(-.32,.32),y:1.85-row*.55,z:z-1.1+k*.72,
      w:.32,h:.32,d:.25,rot:rand(-.2,.2)
    });
   }
  }
 }
 stockGroups.forEach((items,i)=>{
  const cans=items.filter((_,j)=>j%3===0),packs=items.filter((_,j)=>j%3!==0);
  instanced(packs.length,mat(stockColors[i]),j=>packs[j]);
  instanced(cans.length,mat(stockColors[i],.57,.24),j=>({...cans[j],w:.135,d:.135}),unitCylinder);
 });
 box(-7,.52,-29,1.3,1,1.3,parcelMaterial());
 addLight(-15,3.65,-27,0xffbf82,14,21);
 addLight(-5,4,-21,0xd2dfc7,5.2,15);
 for(let z of [-27,-34]){const fixture=box(-11,4.70,z,2.35,.14,.31,matUnique(0xd4bc8a));fixture.material.emissive=new THREE.Color(0x86562c);fixture.material.emissiveIntensity=.7;}
 // Clinic
 house({cx:45,cz:-26,w:31,d:26,frontGap:10,doorX:44,color:masonry("#747973",331,5,2),theme:"clinic"});
 box(44,4.31,-12.61,13.6,1.17,.22,mat(0x343d3e));
 const clinicSign=label("ASHFORD CLINIC",13.4,1.07,"#253b43","#b8dce0",94);clinicSign.position.set(44,4.31,-12.48);world.add(clinicSign);
 windowPanel(34,2.3,-12.65,4,2.5);windowPanel(56,2.3,-12.65,4,2.5);
 for(let x of [34,55])box(x,3.66,-12.54,5.5,.20,.09,mat(0x4b6d71));
 box(44,.12,-12.3,8,.03,.65,mat(0xc1bb9f));
 const redCross=label("+",2.6,2.3,"#e7ded5","#ab3732",140);redCross.position.set(45,6.45,-12.8);world.add(redCross);
 // Reference-guided interior: grimy off-white upper wall, deep hospital teal belt and gray kick panel.
 // All panels are decorative; collision still uses the original solid house walls.
 const clinicTeal=wornSurface(0x153d46,427,4,1);
 const clinicUpper=surfaces.register("painted_plaster_wall",wornSurface(0x989b8f,428,4,1),5.3,1,0xc3ccc0,.54);
 const clinicLower=detailedMaterial(1,0,5,1,0x88877b,.90,.027)??wornSurface(0x676961,429,5,1),trim=mat(0x343a32),door=wornSurface(0x4b6565,430,1,1);
 const medHandle=mat(0x979582,.53,.35);
 for(const [y,h,material] of [[.52,1.0,clinicLower],[2.08,2.15,clinicTeal],[4.09,1.64,clinicUpper]]){
  box(45,y,-38.59,29.3,h,.075,material);
  box(29.91,y,-26,.075,h,24.3,material);
  box(60.09,y,-26,.075,h,24.3,material);
 }
 box(45,1.0,-38.50,29.3,.075,.095,trim);
 box(45,3.18,-38.50,29.3,.085,.095,trim);
 for(const x of [29.97,60.02])for(const y of [1.0,3.18])box(x,y,-26,.095,.08,24.2,trim);
 const rails=mat(0x8a8067);
 for(const x of [35.7,53.1]){
  box(x,1.72,-38.43,8.8,.115,.13,rails);
  for(const bolt of [-3.5,0,3.5])box(x+bolt,1.72,-38.33,.075,.135,.085,trim);
 }
 // Central gray steel door, deep frame, threshold and brass pull.
 box(44,1.63,-38.36,3.6,3.18,.17,trim);
 box(44,1.58,-38.22,3.22,2.94,.11,door);
 box(44,2.43,-38.135,1.3,.44,.032,mat(0x32494b));
 box(45.16,1.58,-38.12,.12,.34,.08,mat(0xb7a178,.46,.72));
 box(44,.15,-37.80,3.59,.07,.91,mat(0x383c38));
 box(44,.189,-37.39,3.59,.015,.072,mat(0x75705a,.69,.19));
 for(const [x,name] of [[36.3,"01 / SUPPLIES"],[54.1,"02 / FIELD MEDIC"]]){
  const sign=label(name,5.8,.62,"#323b36","#e5d7a3",58);
  sign.position.set(x,3.33,-38.39);world.add(sign);
 }
 const access=label("TRIAGE ACCESS",3.1,.52,"#313e3e","#d8cfab",58);
 access.position.set(44,3.55,-38.26);world.add(access);
 clinicCeiling();
 // The illuminated diffuser remains readable with shadows disabled.
 box(45,4.77,-30.05,7.0,.17,.36,mat(0x414743,.72,.13));
 const ceilingGlow=matUnique(0xecebd0,.58);
 ceilingGlow.emissive=new THREE.Color(0xd6f4c4);ceilingGlow.emissiveIntensity=1.8;
 box(45,4.67,-30.05,6.45,.065,.22,ceilingGlow);
 // The triage desk sits behind the side ward, visible from the narrow camera.
 const triageX=53.2,triageZ=-35.4;
 box(triageX,1.04,triageZ,5,2,1.85,wornSurface(0x4c4437,193,2,1));
 box(triageX,2.09,triageZ,5.15,.13,2.02,mat(0x8a7960));
 for(const offset of [-1.6,0,1.6]){
  box(triageX+offset,1.22,triageZ+.94,1.42,1.42,.095,mat(0x4a5042));
  box(triageX+offset,1.78,triageZ+1.005,.67,.06,.035,medHandle);
 }
 box(triageX+.8,2.4,triageZ-.1,.77,.49,.58,mat(0x932b2b));
 box(triageX+.8,2.44,triageZ+.2,.15,.31,.035,mat(0xe4dfcf));
 box(triageX+.8,2.44,triageZ+.205,.42,.095,.04,mat(0xe4dfcf));
 box(triageX+.8,2.68,triageZ-.11,.32,.075,.11,trim);
 // Low-cost dropped rubble to break up the perfectly clean floor without blocking the mission corridor.
 const rubbleMat=mat(0x8d816a),paperMat=mat(0xaaa48d);
 instanced(24,rubbleMat,i=>({x:32+(i*17%26),y:.123,z:-36+(i*11%21),w:.11+(i%4)*.065,h:.048,d:.17+(i%3)*.04,rot:i*.61}));
 instanced(10,paperMat,i=>({x:33+(i*7%25),y:.119,z:-34+(i*5%19),w:.34,h:.015,d:.23,rot:i*.8}));
 // Clinic wayfinding
 for(let z of [-30,-22]){const strip=box(43,.089,z,15,.014,.15,mat(0x9bafad));}
 const frame=mat(0x727970,.55,.3),linen=masonry("#8a8d7d",643,1,1),rail=mat(0x8d9287,.54,.32);
 for(const x of [34,53])for(const z of [-33,-24]){
  const obstacle=box(x,.42,z,3,.8,1,frame,true);
  obstacle.visible=false;
  box(x,.74,z,2.95,.15,1,frame);
  box(x,.88,z,2.78,.16,.91,linen);
  box(x+1.05,1,z,.51,.12,.73,mat(0xada995));
  for(const side of [-1,1]){
   box(x+side*1.35,.47,z,.12,.56,.86,frame);
   box(x+side*1.4,1.04,z,.13,.35,.96,rail);
   box(x,.99,z+side*.48,2.53,.045,.055,rail);
   for(const offset of [-.33,.33]){const wheel=cyl(x+side*1.22,.164,z+offset,.105,.065,coal);wheel.rotation.x=Math.PI/2;}
  }
 }
 // Reuse simple geometry as recognizable clinic details without new mesh imports.
 const medCabinet=mat(0x87938e),medTrim=mat(0xb8c4bd),red=mat(0x9b443e);
 for(const [x,z] of [[39,-36],[50,-35],[35,-19],[56,-20]]){
   box(x,2.0,z,1.35,1.55,.40,medCabinet);
   box(x,2.75,z,1.4,.11,.47,medTrim);
   box(x,2.0,z-.23,.18,.65,.06,red);
   box(x,2.0,z-.24,.65,.18,.07,red);
 }
 // Wheeled supply trolley tucked against the back wall, outside the approach to Dr. Vale.
 const cart=mat(0xb3bdbb,.63,.42);
 for(const y of [.39,1.3])box(40.6,y,-36.36,1.52,.07,.64,cart);
 for(const side of [-1,1])for(const depth of [-.26,.26]){
  box(40.6+side*.70,.81,-36.36+depth,.055,1,.057,cart);
  const caster=cyl(40.6+side*.70,.17,-36.36+depth,.095,.051,coal);caster.rotation.x=Math.PI/2;
 }
 for(const [offset,color] of [[-.42,0xe0dacb],[-.08,0x768880],[.35,0x9f927b]])box(40.6+offset,1.43,-36.36,.24,.20,.32,mat(color));
 for(const x of [36,54]){box(x,1.45,-32.0,.10,1.3,.10,medTrim);
   cyl(x,2.15,-32,.24,.11,medTrim);}
 // Pleated side-ward curtains, clear of the central route.
 const curtainFabric=wornSurface(0x65837d,732,1,1);
 for(const x of [32,58]){
  box(x,3.66,-34,.10,.11,2.78,medTrim);
  for(let pleat=0;pleat<9;pleat++){
   const fold=box(x+(pleat%2?.07:-.07),2.55,-35.08+pleat*.27,.12,2.05,.38,curtainFabric);
   fold.rotation.y=(pleat%2?1:-1)*.57;
  }
 }
 const wardFixture=matUnique(0xc5d6ca);
 wardFixture.emissive.setHex(0x9ac1c1);wardFixture.emissiveIntensity=.7;
 for(const x of [38,48])for(const z of [-34,-27])box(x,4.74,z,2.8,.13,.43,wardFixture);
 addLight(44,4.14,-29.5,0xe6f1d6,12,21);addLight(54,3.32,-33.5,0xb7d0d7,4.5,15);
 const ward=label("WARD B / TRIAGE",4.6,.36,"#414238","#d5cdb5",50);ward.position.set(triageX,1.56,triageZ+1.02);world.add(ward);
 // Patrol car, street debris and reflective safety cones form a readable landmark.
 makeCar(17,2,0x343b40,true);addLight(17,5,4,0xf0bd78,5,18);lamp(23,-8,true);
 for(const [x,z] of [[13,-2],[21,5],[23,1]]){const cone=mesh(new THREE.ConeGeometry(.33,.87,7),mat(0xa8683d),x,.5,z);cone.castShadow=true;
  cyl(x,.105,z,.42,.15,mat(0xb5ac8a));}

 // ambient street furniture
 for(let x of [-56,-27,0,34,65])lamp(x,9,x%2===0);
 const trees=Array.from({length:19},()=>({x:rand(-65,65),z:Math.random()>.5?rand(16,35):rand(-58,-44)}));
 instancedByRegion(trees.map(tree=>({...tree,y:1.35,w:.25,h:2.7,d:.25})),mat(0x55483a),unitCylinder);
 for(let layer=0;layer<3;layer++){
  const canopies=trees.map(t=>({x:t.x+rand(-.6,.6),y:3.2+rand(-.3,.7),z:t.z+rand(-.5,.5),r:rand(.9,1.5)}));
  instancedByRegion(canopies.map(({x,y,z,r})=>({x,y,z,w:r,h:r,d:r})),
   mat([0x47574d,0x59604b,0x3d4c45][layer]),canopyGeometry);
 }
 for(let shade=0;shade<3;shade++)instanced(shade===0?7:shade===1?7:6,mat([0x5b5b52,0x3d4848,0x796352][shade]),i=>({
  x:rand(-67,67),y:.35,z:shade===0?rand(-48,-42):rand(11,23),
  w:rand(.3,1.5),h:rand(.4,1.2),d:rand(.3,1.1),rot:rand(-.2,.2)
 }));
 for(let x of [-65,69])makeCar(x,17,0x675b4e,false);
 const dustPositions=new Float32Array(240*3);
 for(let i=0;i<240;i++){dustPositions[i*3]=rand(-65,65);dustPositions[i*3+1]=rand(.4,4.5);dustPositions[i*3+2]=rand(-39,22);}
 const dustGeom=new THREE.BufferGeometry();dustGeom.setAttribute("position",new THREE.BufferAttribute(dustPositions,3));
 dustParticles=new THREE.Points(dustGeom,new THREE.PointsMaterial({color:0xd1bd9c,size:.07,transparent:true,opacity:.34,depthWrite:false}));
 world.add(dustParticles);
 batchStaticProps();
}
function lamp(x,z,lit){cyl(x,2.7,z,.12,5.4,coal);box(x,5.42,z,.7,.25,1.1,dark);if(lit){addLight(x,5.4,z,0xe9af70,4,14);sphere(x,5.42,z,.24,new THREE.MeshBasicMaterial({color:0xf0bd83}));}}
const sedanChassis=carBody([[-2.39,.42,.68,.91],[-2.12,.33,.92,1.01],[-1.53,.31,.92,1.035],[.99,.31,.91,1.025],[1.75,.33,.82,1.005],[2.27,.36,.77,.95],[2.39,.44,.66,.895]]);
const sedanCabin=carBody([[-1.45,.84,.96,.93],[-.82,.84,1.51,.82],[.39,.84,1.51,.82],[1.23,.84,.93,.93]]);
const sedanRoof=carBody([[-.9,1.445,1.49,.805],[-.7,1.47,1.53,.82],[.32,1.47,1.53,.82],[.49,1.445,1.49,.805]]);
function makeCar(x,z,color,police=false){
 const car=new THREE.Group();car.position.set(x,0,z);world.add(car);
 const paint=mat(color,.62,.22),rubber=mat(0x242420),trim=mat(0x646762,.49,.45),windshield=mat(0x334749,.31,.36);
 mesh(sedanChassis,paint,0,0,0,car).castShadow=true;
 mesh(sedanCabin,windshield,0,0,0,car).castShadow=true;
 mesh(sedanRoof,paint,0,0,0,car).castShadow=true;
 for(const dx of [-1.46,1.47])for(const side of [-1,1]){
  const tire=cyl(dx,.43,side*.99,.414,.25,rubber,car);
  tire.rotation.x=Math.PI/2;
  const rim=cyl(dx,.43,side*1.121,.267,.028,trim,car);
  rim.rotation.x=Math.PI/2;
  const hub=cyl(dx,.43,side*1.14,.09,.018,rubber,car);
  hub.rotation.x=Math.PI/2;
 }
 for(const side of [-1,1]){
  const zEdge=side*1.02;
  box(-.1,.38,zEdge,3.16,.105,.044,rubber,false,car);
  box(.10,1.19,side*.795,.086,.52,.065,rubber,false,car);
  box(.81,1.02,side*.98,.23,.115,.14,paint,false,car);
  for(const dx of [-.56,.72])box(dx,.806,zEdge,.19,.042,.022,trim,false,car);
  box(2.31,.642,side*.626,.075,.17,.49,mat(0xd2bf97,.34,.16),false,car);
  box(-2.335,.616,side*.67,.075,.19,.46,mat(0x7d372d,.42),false,car);
  if(police)box(-.02,.62,side*1.047,3.22,.11,.018,mat(0x888982,.72,.14),false,car);
 }
 box(2.36,.516,0,.10,.19,1.79,rubber,false,car);
 box(-2.36,.496,0,.10,.19,1.85,rubber,false,car);
 box(2.394,.555,0,.017,.112,.415,trim,false,car);
 if(police){
  box(-.08,1.584,0,.27,.078,1.32,rubber,false,car);
  for(const [side,color] of [[-1,0x345572],[1,0x893e38]])box(-.08,1.628,side*.40,.25,.077,.58,mat(color,.36,.2),false,car);
  const sign=label("ASHFORD COUNTY",2.52,.247,"#333d40","#c4c4b3",84);
  sign.position.set(.08,.72,1.05);car.add(sign);
 }
}
function plaidTexture(){
 const c=document.createElement("canvas");c.width=c.height=512;
 const ctx=c.getContext("2d");ctx.fillStyle="#533434";ctx.fillRect(0,0,512,512);
 // Screenshot reference: bright red, dense charcoal plaid with narrow dark seams.
 for(let k=0;k<512;k+=128){
  ctx.fillStyle="rgba(130,48,47,.57)";ctx.fillRect(k+4,0,63,512);ctx.fillRect(0,k+5,512,63);
  ctx.fillStyle="rgba(154,66,58,.56)";ctx.fillRect(k+18,0,9,512);ctx.fillRect(0,k+19,512,9);
  ctx.fillStyle="rgba(23,26,27,.8)";ctx.fillRect(k+68,0,14,512);ctx.fillRect(0,k+68,512,14);
 }
 for(let k=0;k<512;k+=32){
  ctx.fillStyle="rgba(2,5,5,.31)";ctx.fillRect(k,0,3,512);ctx.fillRect(0,k,512,3);
 }
 let seed=91243;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let n=0;n<5500;n++){
  const x=rng()*512,y=rng()*512;ctx.fillStyle=n%4===0?"rgba(198,163,132,.12)":"rgba(0,0,0,.09)";
  ctx.fillRect(x,y,.2+rng()*2,.25+rng()*2.6);
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 return tex;
}
const plaidMat=new THREE.MeshStandardMaterial({map:plaidTexture(),roughness:.98});
const infectedSkin=wornSurface(0x8c9783,923,1,1);
const infectedFabric=Object.freeze({
 walker:wornSurface(0x60635e,1401,1,1),
 runner:wornSurface(0x4e6665,1402,1,1),
 brute:wornSurface(0x5e524c,1403,1,1),
 spitter:wornSurface(0x62745b,1404,1,1)
});
function bodyProfile(rings,segments=12){
 return new THREE.LatheGeometry(rings.map(([radius,y])=>new THREE.Vector2(radius,y)),segments);
}
const jacketShape=bodyProfile([[.85,0],[.96,.06],[.91,.29],[1,.61],[1.02,.81],[.76,.98],[.43,1.04]]);
const sleeveShape=bodyProfile([[.72,0],[.89,.05],[.88,.26],[.95,.48],[1,.67],[.91,.8],[.55,.87]]);
const trouserShape=bodyProfile([[.64,0],[.76,.08],[.81,.34],[.89,.55],[1,.72],[.97,.94],[.76,1]]);
const neckShape=bodyProfile([[.98,0],[1,.13],[.8,.27]]);
const detailedFace=faceGeometry(true),distantFace=faceGeometry(false);
function faceMaterial(color){return new THREE.MeshStandardMaterial({color,roughness:.88,vertexColors:true});}
const faceMaterials={
 player:faceMaterial(0xb28970),mara:faceMaterial(0x9f745c),vale:faceMaterial(0xb38d76),guard:faceMaterial(0xa2836b),
 walker:faceMaterial(0x81867b),runner:faceMaterial(0x8d8876),brute:faceMaterial(0x817b6f),spitter:faceMaterial(0x88927b)
};
const lids=mat(0x534136),sclera=mat(0x8d8374,.61),iris=mat(0x362d25,.52),lips=mat(0x75564c);
function humanFeature(geometry,material,parent,x,y,z,sx,sy,sz,castsShadow=true){
 const part=mesh(geometry,material,x,y,z,parent);
 part.scale.set(sx,sy,sz);part.castShadow=castsShadow;
 return part;
}
function sculptHead(head,kind,skin,infected){
 const geometry=infected?distantFace:detailedFace,material=faceMaterials[kind];
 const scale=kind==="mara"?.94:kind==="brute"?1.09:1;
 const headMesh=humanFeature(geometry,material,head,0,0,-.024,.222*scale,.306*scale,.222*scale);
 if(infected)headMesh.rotation.z=kind==="runner"?-.085:.035;
 for(const side of [-1,1]){
  const x=side*.083*scale;
  humanFeature(canopyGeometry,skin,head,side*.212*scale,-.041,.007,.039,.070,.037);
  const brow=humanFeature(canopyGeometry,lids,head,x,.071,-.224*scale,.050,.015,.016,false);
  brow.rotation.z=side*.12;
  humanFeature(canopyGeometry,infected?mat(0x929282):sclera,head,x,.034,-.228*scale,.039,.015,.018,false);
  if(!infected)humanFeature(canopyGeometry,iris,head,x,.035,-.246*scale,.013,.014,.008,false);
 }
 humanFeature(canopyGeometry,infected?mat(0x514940):lips,head,0,-.125,-.247*scale,.064,.011,.017,false);
}
const survivorHairShape=new THREE.SphereGeometry(1,14,9,0,Math.PI*2,0,Math.PI*.58);
const roundedGear=(()=>{
 const shape=new THREE.Shape();
 shape.moveTo(-.37,-.37);shape.lineTo(.37,-.37);shape.lineTo(.37,.37);shape.lineTo(-.37,.37);shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.74,bevelEnabled:true,bevelSize:.13,bevelThickness:.13,bevelSegments:2,steps:1,curveSegments:1});
 geometry.translate(0,0,-.37);
 return geometry;
})();
const armTop=bodyProfile([[.77,0],[.94,.09],[1.02,.59],[.94,.86],[.62,1]],10);
const armLower=bodyProfile([[.63,0],[.72,.09],[.95,.69],[.98,.92],[.74,1]],10);
const legTop=bodyProfile([[.72,0],[.88,.18],[1,.70],[.94,.94],[.79,1]],11);
const legLower=bodyProfile([[.64,0],[.70,.09],[.83,.28],[.98,.57],[.94,.86],[.75,1]],11);
const backpackShape=(()=>{
 const shape=new THREE.Shape();
 shape.moveTo(-.34,-.41);
 shape.quadraticCurveTo(-.44,-.36,-.42,-.24);
 shape.lineTo(-.39,.27);
 shape.quadraticCurveTo(-.36,.41,-.22,.44);
 shape.quadraticCurveTo(0,.49,.22,.44);
 shape.quadraticCurveTo(.36,.41,.39,.27);
 shape.lineTo(.42,-.24);
 shape.quadraticCurveTo(.44,-.36,.34,-.41);
 shape.quadraticCurveTo(0,-.45,-.34,-.41);
 shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.68,bevelEnabled:true,bevelSize:.072,bevelThickness:.115,bevelSegments:2,steps:1,curveSegments:3});
 geometry.translate(0,0,-.34);
 return geometry;
})();
const survivorCloth=wornSurface(0x514137,926,1,1);
let packCloth=wornSurface(0x37543e,932,1,1);
const hairCloth=wornSurface(0x352720,329,1,1);
const contactShadow=(()=>{
 const canvas=document.createElement("canvas");canvas.width=canvas.height=64;
 const context=canvas.getContext("2d");
 const shade=context.createRadialGradient(32,32,5,32,32,30);
 shade.addColorStop(0,"rgba(10,11,9,.65)");shade.addColorStop(.54,"rgba(10,11,9,.29)");shade.addColorStop(1,"rgba(10,11,9,0)");
 context.fillStyle=shade;context.fillRect(0,0,64,64);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
})();
const shadowPlane=new THREE.PlaneGeometry(1,1);
function attachContactShadow(group,x=0,z=0,y=.085,width=1.43,depth=1.06){
 const shadow=mesh(shadowPlane,contactShadow,x,y,z,group);
 shadow.scale.set(width,depth,1);
 shadow.rotation.x=-Math.PI/2;shadow.receiveShadow=false;
 return shadow;
}
const civilianOutfits={
 mara:{top:mat(0x836955),pants:mat(0x343d41),skin:mat(0xa17558)},
 vale:{top:mat(0xc9cec6),pants:mat(0xaeb5ac),skin:mat(0xb08b6e)},
 guard:{top:mat(0x536c76),pants:mat(0x314852),skin:mat(0xa07f63)}
};
function heldEquipment(arm){
 const steel=mat(0x454946,.50,.38),grip=mat(0x292b28,.91);
 const crowbar=new THREE.Group();crowbar.position.set(.03,-.43,-.024);arm.add(crowbar);
 box(0,-.182,0,.043,.57,.044,mat(0x633931,.59,.25),false,crowbar);
 const end=box(0,-.45,-.033,.045,.118,.042,steel,false,crowbar);
 end.rotation.x=.68;
 box(0,-.49,-.073,.062,.036,.082,steel,false,crowbar);
 const pistol=new THREE.Group();pistol.position.set(.035,-.42,-.041);arm.add(pistol);
 box(0,-.003,-.12,.084,.086,.28,steel,false,pistol);
 const handle=box(0,-.073,-.035,.07,.118,.073,grip,false,pistol);
 handle.rotation.x=-.22;
 box(0,.041,-.209,.025,.02,.052,grip,false,pistol);
 pistol.visible=false;
 return {crowbar,pistol};
}
function createSurvivor(kind){
 const outfit=civilianOutfits[kind];
 const top=outfit?.top??plaidMat,pants=outfit?.pants??survivorCloth;
 const group=new THREE.Group();
 const torso=new THREE.Group();torso.position.y=1.13;group.add(torso);
 const head=new THREE.Group();head.position.set(0,1.26,-.015);torso.add(head);
 if(kind==="player")head.scale.set(.94,.97,.95);
 const skin=outfit?.skin??mat(0xaa8065),boot=mat(kind==="vale"?0x77786c:0x392d20),sole=mat(0x242321),edge=mat(0x252d23),straps=mat(0x55624b),metal=mat(0x888374,.56,.5);
 const shaped=humanFeature;
 shaped(jacketShape,top,torso,0,0,0,.439,1,.245);
 shaped(neckShape,skin,torso,0,1.01,0,.123,1,.116);
 sculptHead(head,kind,skin,false);
 const cap=shaped(survivorHairShape,hairCloth,head,0,.049,.025,.226,.308,.228);
 cap.rotation.x=kind==="mara"?-.005:-.21;
 shaped(unitSphere,hairCloth,head,0,-.067,.146,.157,.083,.092);
 shaped(roundedGear,pants,group,0,1.13,.009,.66,.28,.42);
 const limbs=[],elbows=[],knees=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.423,.856,-.013);torso.add(arm);
  arm.rotation.z=side*.089;
  shaped(armTop,top,arm,0,-.407,0,.139,.488,.153);
  const elbow=new THREE.Group();elbow.position.set(side*.013,-.405,-.006);arm.add(elbow);
  shaped(armLower,top,elbow,0,-.355,-.006,.134,.403,.129);
  shaped(unitSphere,skin,elbow,side*.008,-.424,-.019,.066,.104,.052);
  shaped(unitSphere,skin,elbow,side*-.035,-.398,-.055,.031,.063,.035);
  elbows.push(elbow);limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.172,1.11,.017);group.add(leg);
  shaped(legTop,pants,leg,0,-.552,0,.181,.625,.169);
  const knee=new THREE.Group();knee.position.set(0,-.507,-.008);leg.add(knee);
  shaped(legLower,pants,knee,0,-.438,0,.149,.499,.151);
  shaped(roundedGear,boot,knee,0,-.446,-.089,.244,.233,.425);
  box(0,-.562,-.087,.248,.069,.43,sole,false,knee);
  knees.push(knee);limbs.push(leg);
 }
 if(kind==="player"){
  box(0,.489,-.244,.037,.833,.028,mat(0x42322d),false,torso);
  for(const y of [.194,.365,.539,.717])box(.009,y,-.263,.031,.027,.011,metal,false,torso);
  shaped(backpackShape,packCloth,torso,0,.51,.397,.676,.954,.444);
  shaped(backpackShape,edge,torso,0,.505,.585,.518,.685,.153);
  shaped(backpackShape,packCloth,torso,0,.443,.654,.475,.478,.134);
  box(0,.669,.722,.39,.022,.025,straps,false,torso);
  box(0,.925,.432,.218,.082,.098,edge,false,torso);
  for(const side of [-1,1]){
   const collar=box(side*.098,.928,-.172,.132,.13,.052,top,false,torso);
   collar.rotation.z=side*.43;
   const strap=box(side*.276,.473,-.237,.072,.818,.056,edge,false,torso);strap.rotation.z=side*.10;
   shaped(roundedGear,packCloth,torso,side*.33,.426,.412,.13,.45,.30);
   box(side*.219,.522,.722,.038,.554,.021,straps,false,torso);
   box(side*.22,.685,.738,.067,.075,.024,metal,false,torso);
  }
  box(0,.449,.729,.375,.020,.015,metal,false,torso);
  box(-.139,.427,.744,.026,.046,.019,metal,false,torso);
 }else if(kind==="vale"){
  const piping=mat(0x799396),pocket=mat(0xb0b8b3);
  box(0,.41,-.265,.038,.69,.033,pocket,false,torso);
  box(.178,.66,-.255,.117,.146,.045,piping,false,torso);
  box(.178,.70,-.279,.073,.027,.006,mat(0xc9c3a6),false,torso);
 }else if(kind==="guard"){
  shaped(roundedGear,mat(0x5f6555),head,0,.25,0,.48,.167,.47);
  shaped(roundedGear,mat(0x50574a),head,0,.207,-.193,.455,.048,.253);
  box(-.19,.67,-.26,.102,.114,.033,mat(0x92968b),false,torso);
 }else{
  box(0,.36,-.251,.55,.65,.055,mat(0x4b4137),false,torso);
  box(.118,.27,-.286,.24,.21,.042,mat(0x554537),false,torso);
 }
 for(const part of [group,torso,head,...limbs,...elbows,...knees])batchStaticProps(part);
 group.userData={limbs,head,torso,elbows,knees};
 if(kind==="player")group.userData.equipment=heldEquipment(elbows[1]);
 return group;
}
const infectedGlow=new THREE.MeshStandardMaterial({color:0x69794b,emissive:0x40612b,emissiveIntensity:.33,roughness:.85});
function humanoid(kind){
 if(kind==="player"||Object.hasOwn(civilianOutfits,kind))return createSurvivor(kind);
 const group=new THREE.Group();
 const skin=infectedSkin;
 const fabric=infectedFabric[kind]??infectedFabric.walker;
 const pants=mat(0x48473f);
 const torso=mesh(jacketShape,fabric.clone(),0,1.07,0,group);
 torso.scale.set(kind==="brute"?.53:.424,1,.24);torso.castShadow=true;
 humanFeature(roundedGear,pants,group,0,1.075,0,.64,.28,.41);
 humanFeature(neckShape,skin,group,0,2.0,-.025,.113,.96,.108);
 const head=new THREE.Group();head.position.set(0,2.36,-.062);group.add(head);
 sculptHead(head,kind,skin,true);
 const hair=humanFeature(survivorHairShape,mat(0x44433c),head,0,.042,.056,.222,.296,.207);
 hair.rotation.x=-.29;
 const limbs=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.453,1.92,0);group.add(arm);
  const sleeve=humanFeature(sleeveShape,fabric,arm,side*.07,-.747,0,.15,.96,.135);
  sleeve.rotation.z=side*.11;
  humanFeature(unitSphere,skin,arm,side*.09,-.835,-.02,.069,.126,.061);limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.176,1.09,0);group.add(leg);
  humanFeature(trouserShape,pants,leg,0,-.91,0,.176,1,.159);
  humanFeature(roundedGear,dark,leg,0,-.967,-.07,.252,.206,.39);
  limbs.push(leg);
 }
 if(kind==="brute"){
  group.scale.set(1.32,1.27,1.24);torso.scale.x*=1.35;head.scale.x*=1.12;
  for(const side of [-1,1])humanFeature(unitSphere,fabric,group,side*.55,1.96,.015,.205,.226,.171);
 }
 if(kind==="runner"){
  torso.rotation.x=-.30;head.position.z=-.20;group.scale.set(.91,1,.92);
  limbs[0].rotation.z=.25;limbs[2].rotation.z=-.30;
 }
 if(kind==="walker")head.rotation.z=-.09;
 if(kind==="brute")head.position.y-=.06;
 if(kind==="spitter"){
  const glow=infectedGlow;
  humanFeature(unitSphere,glow,group,0,1.65,-.215,.179,.23,.101);
  for(const side of [-1,1]){sphere(side*.42,1.35,-.28,.21,glow,group);}
  sphere(0,2.02,-.29,.18,glow,group);
 }

 group.userData={limbs,head,torso,neckTilt:head.rotation.z};
 return group;
}
function createNPC(kind,x,z,angle){
 const character=humanoid(kind);
 character.position.set(x,0,z);character.rotation.y=angle;
 const {limbs,head,torso}=character.userData;
 torso.rotation.z=kind==="guard"?-.046:.034;
 head.rotation.y=kind==="guard"?.16:-.12;
 limbs[0].rotation.x=-.10;limbs[2].rotation.x=.07;
 world.add(character);attachContactShadow(world,x,z);
 return character;
}
function spawnEnemy(type,x,z,ambush=false){
 const c=humanoid(type);c.position.set(x,0,z);world.add(c);
 const spec=INFECTED[type]||INFECTED.walker;
 enemies.push({type,mesh:c,x,z,hp:spec.health,max:spec.health,speed:spec.speed,
  cd:rand(.5,1.2),phase:rand(0,10),dead:false,death:0,ambush,
  attackIntent:null,windup:0,hitFlash:0,stagger:0,route:[],routeTimer:rand(.05,.45),routeTarget:{x:NaN,z:NaN}});
}
function spawnAmbient(){spawnEnemy("walker",-27,3);spawnEnemy("runner",5,13);spawnEnemy("spitter",32,11);}
function makeMarker(){
 marker=new THREE.Group();scene.add(marker);
 markerRing=mesh(new THREE.TorusGeometry(.53,.033,5,32),goldMat,0,.146,0,marker);
 markerRing.rotation.x=Math.PI/2;
 markerDiamond=mesh(new THREE.OctahedronGeometry(.15),goldMat,0,2.65,0,marker);
}
function setMarker(){const obj=stages[state.stage];if(!obj){marker.visible=false;return;}marker.visible=true;marker.position.set(obj.point.x,0,obj.point.z);refreshObjective();}
function refreshObjective(){
 const q=stages[state.stage];if(!q)return;
 $("objective-title").textContent=q.title;$("objective-detail").textContent=q.desc;
 $("objective-number").textContent=String(state.stage+1).padStart(2,"0")+" / 09";
 $("supply-count").textContent="SUPPLIES "+state.supplies+"/1";
}
function toast(text){const el=$("notification");el.textContent=text;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2800);}
function advance(){state.stage=Math.min(state.stage+1,8);tone(710,.28,"sine",.07);toast("OBJECTIVE UPDATED");setMarker();saveGame();}
function closeAll(){for(const id of ["dialogue","pack-modal","pause-modal"])$(id).classList.remove("visible");activeDialog=false;}
function showDialogue(speaker,text,callback){state.paused=true;activeDialog=true;$("dialogue-speaker").textContent=speaker;$("dialogue-text").textContent=text;$("dialogue").classList.add("visible");
 $("dialogue-next").onclick=()=>{$("dialogue").classList.remove("visible");activeDialog=false;state.paused=false;if(callback)callback();};}
function interact(){
 if(!state.started||state.paused)return;
 const q=stages[state.stage];if(q.kind!=="interact"){toast("FOLLOW THE WAYPOINT");return;}
 if(dist(pos(),q.point)>4){toast("MOVE CLOSER TO INTERACT");return;}
 if(state.stage===2)showDialogue("MARA","You're still breathing? Good. The water's in the back aisle. Get it before the others come. A patrol car stopped outside the clinic road—might be something useful there.",advance);
 else if(state.stage===3){state.supplies=1;state.inventory.water+=2;state.inventory.food+=2;toast("SUPPLIES RECOVERED + WATER + FOOD");tone(900,.2);advance();}
 else if(state.stage===4){state.hasGun=true;state.weapon="pistol";state.ammo=36;toast("PISTOL RECOVERED · 36 ROUNDS");tone(920,.24);advance();}
 else if(state.stage===6)showDialogue("DR. VALE","You brought supplies. That's more than I expected. Hold the entrance while I stabilize the ward. They're coming from the road—don't let them inside.",()=>{advance();startWave();});
 else if(state.stage===8)victory();
}
function startWave(){state.waveStarted=true;state.waveKills=0;state.waveTimer=0;
 for(const [type,x,z] of [["walker",32,6],["runner",51,6],["brute",61,4],["spitter",27,-3],["walker",56,12],["runner",37,12]])spawnEnemy(type,x,z,true);
 toast("CLINIC UNDER ATTACK");}
function victory(){state.ended=true;state.paused=true;$("end-label").textContent="OPENING ROUTE CLEARED";$("end-title").textContent="FIRST NIGHT SURVIVED.";$("end-message").textContent="You reached the ward, found allies, and secured Ashford Clinic. This is the end of the reconstruction opening slice.";$("gameover").classList.add("visible");localStorage.removeItem("ashfordRebirthV01");tone(680,.6);}
function gameOver(){state.ended=true;state.paused=true;$("end-label").textContent="SIGNAL LOST";$("end-title").textContent="YOU DID NOT SURVIVE.";$("end-message").textContent="The dead claimed another survivor. Return to the start and try again.";$("gameover").classList.add("visible");localStorage.removeItem("ashfordRebirthV01");tone(125,.6,"sawtooth",.08);}
function takeDamage(amount){if(state.qaNoDamage||state.hitTime>.05||state.dodgeIFrames>0)return;state.health=clamp(state.health-amount,0,100);state.hitTime=.45;$("damage-flash").style.opacity=.75;sound.burst(180,.17,.26,0,"lowpass");tone(105,.21,"sine",.15);setTimeout(()=>$("damage-flash").style.opacity=0,130);if(state.health<=0)gameOver();}
function confirmHit(killed=false){
 state.hitConfirm=killed?.38:.22;
 const marker=$("crosshair");marker.classList.remove("hit","kill");void marker.offsetWidth;
 marker.classList.add(killed?"kill":"hit");
}
function dodge(){
 if(!state.started||state.paused||state.ended)return;
 if(!canDodge(state.stamina,state.dodgeCooldown,state.dodgeTime>0)){tone(160,.08);return;}
 const forward={x:-Math.sin(cameraYaw),z:-Math.cos(cameraYaw)};
 const right={x:Math.cos(cameraYaw),z:-Math.sin(cameraYaw)};
 const mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+touch.x;
 const mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-touch.y;
 const v=normalize2D(right.x*mx+forward.x*mz,right.z*mx+forward.z*mz,{x:-forward.x,z:-forward.z});
 state.stamina-=DODGE.cost;state.dodgeTime=DODGE.duration;state.dodgeCooldown=DODGE.cooldown;
 state.dodgeIFrames=DODGE.invulnerability;state.dodgeDir=v;state.meleeAnim=0;
 sound.burst(460,.15,.22);
}
function melee(){
 if(state.attackTime>0||!state.started||state.paused)return;
 state.attackTime=WEAPONS.crowbar.cooldown;state.meleeAnim=WEAPONS.crowbar.cooldown;
 sound.burst(830,.15,.21);
 const p=pos(),facing=aimDirection();
 const target=chooseTarget(p,{x:facing.x,z:facing.z},enemies,"crowbar",obstacles);
 if(target)hurtEnemy(target,WEAPONS.crowbar.damage,"crowbar");
 const slash=mesh(new THREE.TorusGeometry(1.15,.045,5,25,Math.PI*.86),
  new THREE.MeshBasicMaterial({color:0xe9d6b6,transparent:true,opacity:.44}),
  state.x+facing.x*.8,1.5,state.z+facing.z*.8,world);
 slash.rotation.set(.35,-state.angle,0);
 effects.push({mesh:slash,life:.18,total:.18,kind:"fade",opacity:.48});
}
function shoot(){
 if(!state.started||state.paused||state.shootTime>0)return;
 if(!state.hasGun){toast("FIND A FIREARM FIRST");return;}
 if(state.ammo<=0){toast("OUT OF AMMO — USE MELEE");tone(180,.05);return;}
 state.ammo--;state.shootTime=WEAPONS.pistol.cooldown;
 state.pistolAnim=.28;state.cameraKick=Math.max(state.cameraKick,.18);
 sound.burst(2300,.145,.58,0,"lowpass");tone(107,.13,"triangle",.24);
 const facing=aimDirection();
 const target=chooseTarget(pos(),{x:facing.x,z:facing.z},enemies,"pistol",obstacles);
 const src=V(state.x+facing.x*.7,1.75,state.z+facing.z*.7);
 const end=target?V(target.x,1.7,target.z):src.clone().addScaledVector(facing,24);
 if(target)hurtEnemy(target,WEAPONS.pistol.damage,"pistol");
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([src,end]),
  new THREE.LineBasicMaterial({color:0xf9d38e,transparent:true,opacity:.95}));
 world.add(line);effects.push({mesh:line,life:.085,total:.085,kind:"fade",opacity:.76});
 const flash=sphere(src.x,src.y,src.z,.23,new THREE.MeshBasicMaterial({color:0xffde8c,transparent:true,opacity:1}));
 effects.push({mesh:flash,life:.09,total:.09,kind:"fade"});
}
function hurtEnemy(e,damage,weapon="pistol"){
 if(e.dead||e.hp<=0)return;
 const hit=applyHit(e.hp,damage);e.hp=hit.health;
 e.hitFlash=.18;e.stagger=e.type==="brute"?.13:.22;
 if(e.type!=="brute"&&e.attackIntent){e.attackIntent=null;e.cd=Math.max(e.cd,.35);}
 const dx=e.x-state.x,dz=e.z-state.z;
 const pan=clamp((Math.cos(cameraYaw)*dx-Math.sin(cameraYaw)*dz)/9,-.82,.82);
 sound.burst(weapon==="pistol"?630:370,.124,.28,pan);
 confirmHit(hit.killed);
 if(!hit.killed)return;
 e.dead=true;e.death=1.7;e.attackIntent=null;state.kills++;
 if(state.waveStarted&&e.ambush){
  state.waveKills++;toast("INFECTED NEUTRALIZED "+state.waveKills+" / 4");
 }
 if(state.stage===7&&state.waveKills>=4){state.waveStarted=false;advance();}
}
function launchSpit(e,p){
 const d=Math.max(.01,dist(e,p));
 const orb=sphere(e.x,1.65,e.z,.20,new THREE.MeshBasicMaterial({color:0x98e364,transparent:true}));
 effects.push({mesh:orb,life:3,total:3,kind:"spit",
  vx:(p.x-e.x)/d*8,vz:(p.z-e.z)/d*8,damage:INFECTED.spitter.rangedDamage});
 tone(225,.16,"triangle",.035);
}
function removeEnemy(enemy){
 world.remove(enemy.mesh);
 // The torso owns its hit-flash material; the fabric map is shared by its archetype.
 enemy.mesh.userData.torso.material.dispose();
}
function updateEnemies(dt){
 const p=pos();
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];
  if(e.dead){
   e.death-=dt;
   const fall=clamp((1.7-e.death)/.64,0,1),landing=1-Math.pow(1-fall,3);
   e.mesh.rotation.z=landing*1.43;
   e.mesh.rotation.x=landing*.18;
   e.mesh.position.y=-landing*.24;
   if(e.death<=0){removeEnemy(e);enemies.splice(i,1);}
   continue;
  }
  e.phase+=dt*(e.type==="runner"?9:5);
  e.cd=Math.max(0,e.cd-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);
  e.stagger=Math.max(0,e.stagger-dt);
  const d=dist(p,e),attacking=Boolean(e.attackIntent);
  if(d<38&&d>1.2&&state.started&&!state.paused&&e.stagger<=0&&!attacking){
   e.routeTimer-=dt;
   if(e.routeTimer<=0||dist(p,e.routeTarget)>3){
    e.route=findRoute(e,p,obstacles,{step:1.75,clearance:.45,maxVisited:4400});
    if(!e.route.length)e.route=findRoute(e,chaseGoal(e,p),obstacles,{step:1.75,clearance:.45,maxVisited:2200});
    e.routeTimer=rand(.85,1.45);e.routeTarget={x:p.x,z:p.z};
   }
   while(e.route.length>1&&dist(e,e.route[0])<.6)e.route.shift();
   const goal=e.route[0]||chaseGoal(e,p),gd=Math.max(.01,dist(e,goal)),speed=e.speed*dt;
   const dx=(goal.x-e.x)/gd,dz=(goal.z-e.z)/gd;
   let nx=e.x+dx*speed,nz=e.z+dz*speed;
   if(!blocked(nx,nz,.42)&&!lineBlocked(e.x,e.z,nx,nz,.42)){e.x=nx;e.z=nz;}
   else if(!blocked(nx,e.z,.42)){e.x=nx;}
   else if(!blocked(e.x,nz,.42)){e.z=nz;}
   else e.routeTimer=0;
   e.mesh.rotation.y=Math.atan2(-dx,-dz);
  }
  // All attacks now have a telegraphed anticipation phase and are
  // validated against current distance / cover when the strike resolves.
  const newDist=dist(e,p);
  if(e.attackIntent){
   e.windup-=dt;
   if(e.windup<=0){
    const intent=e.attackIntent;e.attackIntent=null;e.cd=intent.cooldown;
    if(attackStillValid(intent,newDist)&&!lineBlocked(e.x,e.z,p.x,p.z,.1)){
     if(intent.kind==="spit")launchSpit(e,p);
     else takeDamage(intent.damage);
    }
   }
  }else if(newDist<=(e.type==="spitter"?SPIT_RANGE:ATTACK_RANGE)&&e.cd<=0&&e.stagger<=0){
   const intent=chooseInfectedAction(e.type,newDist);
   if(intent&&!lineBlocked(e.x,e.z,p.x,p.z,.1)){e.attackIntent=intent;e.windup=intent.windup;}
  }
  const stride=Math.sin(e.phase),looms=e.type==="brute",runs=e.type==="runner";
  e.mesh.position.set(e.x,Math.abs(stride)*(runs?.035:.014),e.z);
  animateLimbs(e.mesh,stride*(attacking?.16:looms?.48:runs?.80:.53));
  const {torso,head,neckTilt}=e.mesh.userData;
  const windup=e.attackIntent?Math.sin(Math.PI*(1-e.windup/e.attackIntent.windup)):.0;
  const recoil=e.hitFlash/.18;
  torso.rotation.x=(runs?-.30:0)+windup*(looms?.42:e.type==="spitter"?-.55:.23)+recoil*.24;
  torso.rotation.z=stride*(looms?.044:.065)-recoil*.12;
  head.rotation.x=-windup*.12+recoil*.20;
  head.rotation.z=neckTilt-stride*.027;
  if(windup>0){
   const arms=e.mesh.userData.limbs;
   const reach=e.type==="spitter"?-.28:windup*(e.type==="brute"?1.55:1.02);
   arms[0].rotation.x+=reach;
   arms[2].rotation.x+=reach*.92;
  }
  torso.material.emissive.setHex(e.hitFlash>0?0x6b2616:0x000000);
  torso.material.emissiveIntensity=e.hitFlash>0?1.15:0;
 }
}
function animateLimbs(char,amount){const limbs=char.userData.limbs;if(!limbs)return;limbs[0].rotation.x=amount*.48;limbs[1].rotation.x=-amount*.65;limbs[2].rotation.x=-amount*.48;limbs[3].rotation.x=amount*.65;}

function poseSurvivor(moving,sprinting){
 const {limbs,head,torso,equipment,elbows,knees}=playerVisual.userData;
 if(!limbs)return;
 // Additive animation over original four pivot groups: no replacement skeleton.
 torso.rotation.x=sprinting?-.13:moving?-.035:Math.sin(state.time*1.7)*.012;
 torso.rotation.z=moving?Math.sin(state.time*7)*.015:Math.sin(state.time*1.15)*.008;
 head.rotation.x=sprinting?.08:0;
 head.rotation.y=clamp(Math.sin(state.angle-playerVisual.rotation.y)*.5,-.25,.25);
 const swing=state.meleeAnim>0?Math.sin(Math.PI*(1-state.meleeAnim/WEAPONS.crowbar.cooldown)):0;
 const recoil=state.pistolAnim>0?Math.sin(Math.PI*(1-state.pistolAnim/.28)):0;
 const stride=Math.sin(gaitPhase)*gaitBlend;
 const roll=state.dodgeTime>0?Math.sin(Math.PI*(1-state.dodgeTime/DODGE.duration)):0;
 knees[0].rotation.x=-(.065+Math.max(0,stride)*.67+roll*.51);
 knees[1].rotation.x=-(.065+Math.max(0,-stride)*.67+roll*.51);
 elbows[0].rotation.x=.14+Math.max(0,-stride)*.38+roll*.31;
 elbows[1].rotation.x=.15+Math.max(0,stride)*.36+swing*.26+roll*.31;
 torso.rotation.x+=roll*.35;
 const gunDrawn=state.hasGun&&state.meleeAnim<=0;
 equipment.pistol.visible=gunDrawn;
 equipment.crowbar.visible=!gunDrawn;
 limbs[2].rotation.x+=swing*1.48;
 limbs[2].rotation.z=-swing*.53;
 if(gunDrawn){
  limbs[2].rotation.x+=.30+recoil*.88;
  limbs[0].rotation.x+=recoil*.34;
  elbows[1].rotation.x+=.32+recoil*.08;
  equipment.pistol.rotation.x=-.65-recoil*.73;
 }
 // Differentiate sprint, sidestep and idle without expensive animation mixers.
 if(sprinting){limbs[0].rotation.x*=1.35;limbs[1].rotation.x*=1.30;limbs[3].rotation.x*=1.30;}
}

function blocked(x,z,r=.3){return isBlocked2D(x,z,r,obstacles);}

function lineBlocked(x1,z1,x2,z2,r=.1){return hasCover(x1,z1,x2,z2,r,obstacles);}
function aimDirection(){
 state.angle=cameraYaw;
 playerVisual.rotation.y=state.angle;
 return V(-Math.sin(state.angle),0,-Math.cos(state.angle));
}
function chaseGoal(enemy,target){return chooseChaseGoal(enemy,target);}
function updatePlayer(dt){
 let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+touch.x;
 let mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-touch.y;
 const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len;}
 const moving=Math.hypot(mx,mz)>.06;
 const sprint=(keys.ShiftLeft||keys.ShiftRight||touch.sprint)&&state.stamina>2&&moving;
 const forward=V(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw)),right=V(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));
 const previousX=state.x,previousZ=state.z;
 let dx=0,dz=0;
 const rolling=state.dodgeTime>0;
 if(rolling){
  dx=state.dodgeDir.x*DODGE.speed*dt;dz=state.dodgeDir.z*DODGE.speed*dt;
 }else{
  const speed=(sprint?7.15:4.25)*dt;
  dx=(forward.x*mz+right.x*mx)*speed;dz=(forward.z*mz+right.z*mx)*speed;
 }
 if(rolling||moving){
  if(!blocked(state.x+dx,state.z,.35))state.x+=dx;
  if(!blocked(state.x,state.z+dz,.35))state.z+=dz;
  if(!rolling&&moving)state.angle=Math.atan2(-dx,-dz);
 }
 if(!rolling&&sprint)state.stamina=clamp(state.stamina-dt*18,0,100);
 else state.stamina=clamp(state.stamina+dt*13,0,100);
 state.dodgeTime=Math.max(0,state.dodgeTime-dt);
 state.dodgeCooldown=Math.max(0,state.dodgeCooldown-dt);
 state.dodgeIFrames=Math.max(0,state.dodgeIFrames-dt);
 state.thirst=clamp(state.thirst-dt*.026,0,100);state.hunger=clamp(state.hunger-dt*.012,0,100);
 if(state.thirst<3||state.hunger<3){
  state.health=clamp(state.health-dt*.8,0,100);
  if(state.health===0){gameOver();return;}
 }
 const travel=Math.hypot(state.x-previousX,state.z-previousZ);
 const stepping=!rolling&&travel>.001;
 if(stepping){
  gaitPhase=(gaitPhase+travel*2.22)%(2*Math.PI);
  stepTravel+=travel;
  const stride=sprint?2.16:1.57;
  if(stepTravel>=stride){
   stepTravel%=stride;
   leftStep=!leftStep;
   const room=ENTRANCES.findIndex(box=>state.x>box.left&&state.x<box.right&&state.z>box.back&&state.z<box.front);
   sound.footstep(room===0?"wood":room>0?"tile":"asphalt",sprint,leftStep);
  }
 }
 playerSprint=stepping&&sprint;
 gaitBlend+=((stepping?1:0)-gaitBlend)*(1-Math.exp(-dt*13));
 const crouch=rolling?Math.sin(Math.PI*(1-state.dodgeTime/DODGE.duration))*.40:0;
 playerVisual.position.set(state.x,(1-Math.cos(gaitPhase*2))*gaitBlend*.028-crouch,state.z);
 playerShadow.position.set(state.x,.085,state.z);
 const facingDifference=state.angle-playerVisual.rotation.y;
 playerVisual.rotation.y+=Math.atan2(Math.sin(facingDifference),Math.cos(facingDifference))*(1-Math.exp(-dt*18));
 animateLimbs(playerVisual,Math.sin(gaitPhase)*gaitBlend*(sprint?1.1:.72));
 poseSurvivor(stepping,stepping&&sprint);
 if(rolling){playerVisual.userData.torso.rotation.z=.32*Math.sin((1-state.dodgeTime/DODGE.duration)*Math.PI);}
 state.attackTime=Math.max(0,state.attackTime-dt);state.shootTime=Math.max(0,state.shootTime-dt);state.hitTime=Math.max(0,state.hitTime-dt);
 state.meleeAnim=Math.max(0,state.meleeAnim-dt);state.pistolAnim=Math.max(0,state.pistolAnim-dt);
 state.cameraKick=Math.max(0,state.cameraKick-dt*.85);state.hitConfirm=Math.max(0,state.hitConfirm-dt);
 if(state.hitConfirm===0)$("crosshair").classList.remove("hit","kill");
 const q=stages[state.stage];if(q.kind==="arrive"&&dist(pos(),q.point)<q.radius){if(state.stage===8)victory();else advance();}
 if(state.stage===7){state.waveTimer+=dt;if(state.waveTimer>6&&state.waveKills<4&&enemies.filter(e=>!e.dead&&e.ambush).length<3){spawnEnemy("walker",rand(22,58),rand(6,18),true);state.waveTimer=0;}}
}
function updateEffects(dt){
 for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;
 if(e.kind==="spit"){const nx=e.mesh.position.x+e.vx*dt,nz=e.mesh.position.z+e.vz*dt;
  if(blocked(nx,nz,.22)){e.life=0;}else{e.mesh.position.x=nx;e.mesh.position.z=nz;
    if(dist({x:nx,z:nz},pos())<.8){takeDamage(e.damage||10);e.life=0;}}}
 if(e.mesh.material&&"opacity"in e.mesh.material)e.mesh.material.opacity=clamp(e.life/e.total,0,1)*(e.opacity??.9);
 if(e.life<=0){world.remove(e.mesh);if(e.mesh.geometry&&e.mesh.geometry!==unitSphere&&e.mesh.geometry!==unitCylinder&&e.mesh.geometry!==unitCube)e.mesh.geometry.dispose();if(e.mesh.material&&!materialCacheHas(e.mesh.material))e.mesh.material.dispose();effects.splice(i,1);}
 }
}
function hud(){
 const pct=(id,v)=>$(id).style.width=clamp(v,0,100)+"%";
 pct("hp-bar",state.health);pct("st-bar",state.stamina);pct("th-bar",state.thirst);pct("hu-bar",state.hunger);
 $("hp-num").textContent=Math.ceil(state.health)+" / 100";$("st-num").textContent=Math.ceil(state.stamina)+" / 100";
 $("th-num").textContent=Math.ceil(state.thirst)+"%";$("hu-num").textContent=Math.ceil(state.hunger)+"%";
 $("weapon-name").textContent=state.hasGun?"PISTOL + CROWBAR":"CROWBAR";
 $("weapon-card-label").textContent=state.hasGun?"SERVICE PISTOL":"CROWBAR";
 $("weapon-card-ammo").textContent=state.hasGun?state.ammo+" ROUNDS":"MELEE READY";
 $("ammo").textContent=state.hasGun?state.ammo+" ROUNDS":"MELEE";
 $("dodge-status").textContent=state.dodgeCooldown>0?"ROLL "+state.dodgeCooldown.toFixed(1)+"s":"ROLL READY";
 const dayMinutes=16*60+Math.floor(state.time/3);
 const day=1+Math.floor(dayMinutes/1440),minutes=dayMinutes%1440;
 const pad=n=>String(n).padStart(2,"0");
 $("world-clock").textContent="DAY "+day+" · "+pad(Math.floor(minutes/60))+":"+pad(minutes%60)+" · N";
 $("world-condition").textContent="FOOD "+Math.ceil(state.hunger)+" · WATER "+Math.ceil(state.thirst);

 const q=stages[state.stage];$("waypoint-distance").textContent=Math.round(dist(pos(),q.point))+" m";
 $("danger-text").textContent=state.stage===7?"INFECTED ASSAULT · "+state.waveKills+"/4":"AIRBORNE CONTAMINATION";
 if(q.kind==="interact"&&dist(pos(),q.point)<4){$("context").hidden=false;$("context-label").textContent=($("mobile-controls").hidden?"PRESS E · ":"USE · ")+q.name;}else $("context").hidden=true;
}
function drawMap(){
 const c=$("minimap"),ctx=c.getContext("2d"),w=c.width,h=c.height;
 const px=x=>(x+75)/150*w,pz=z=>(z+55)/100*h;
 ctx.fillStyle="#1a2729";ctx.fillRect(0,0,w,h);
 ctx.fillStyle="#484d4a";ctx.fillRect(0,pz(-8),w,pz(16)-pz(0));ctx.fillStyle="#6d6b60";ctx.fillRect(0,pz(-12),w,pz(4)-pz(0));ctx.fillRect(0,pz(8),w,pz(4)-pz(0));
 for(const b of [{x:-49,z:-26,w:25,d:23},{x:-11,z:-26,w:26,d:24},{x:45,z:-26,w:31,d:26}]){ctx.fillStyle="#65716f";ctx.fillRect(px(b.x-b.w/2),pz(b.z-b.d/2),b.w/150*w,b.d/100*h);}
 for(const e of enemies){if(e.dead)continue;ctx.fillStyle="#c3614f";ctx.beginPath();ctx.arc(px(e.x),pz(e.z),2,0,Math.PI*2);ctx.fill();}
 const q=stages[state.stage];ctx.strokeStyle="#eac48a";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px(q.point.x),pz(q.point.z),5,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle="#ebdbb6";ctx.beginPath();ctx.arc(px(state.x),pz(state.z),3.4,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#ebdbb6";ctx.beginPath();ctx.moveTo(px(state.x),pz(state.z));ctx.lineTo(px(state.x)-Math.sin(state.angle)*9,pz(state.z)-Math.cos(state.angle)*9);ctx.stroke();
 ctx.strokeStyle="#778984";ctx.lineWidth=2;ctx.strokeRect(1,1,w-2,h-2);
}
function constrainCamera(position){
 cameraDirection.subVectors(position,cameraPivot);
 const distance=cameraDirection.length();
 if(distance===0)return;
 cameraDirection.divideScalar(distance);
 cameraRay.set(cameraPivot,cameraDirection);cameraRay.near=0;cameraRay.far=distance;
 cameraHits.length=0;
 cameraRay.intersectObjects(solidMeshes,false,cameraHits);
 if(cameraHits.length)position.copy(cameraPivot).addScaledVector(cameraDirection,Math.max(0,cameraHits[0].distance-.22));
}
function updateCamera(dt){
 const yawX=Math.sin(cameraYaw),yawZ=Math.cos(cameraYaw);
 const wideFrame=clamp((camera.aspect-.65)/.55,0,1);
 const shoulder=.30+.60*wideFrame;
 const motion=cameraMotion&&state.started&&!state.paused;
 viewSprint+=((motion&&playerSprint?1:0)-viewSprint)*(1-Math.exp(-dt*6));
 const fov=58+viewSprint*3.4;
 if(Math.abs(fov-camera.fov)>.017){camera.fov=fov;camera.updateProjectionMatrix();}
 const reach=5+.23*viewSprint;
 const horizontal=Math.cos(cameraPitch)*reach;
 const vertical=Math.sin(cameraPitch)*reach+(motion?state.cameraKick*.85:0);
 cameraPivot.set(state.x,1.82,state.z);
 cameraDesired.set(state.x+yawX*horizontal+yawZ*shoulder,vertical+1.54,state.z+yawZ*horizontal-yawX*shoulder);
 camera.position.lerp(cameraDesired,1-Math.exp(-dt*8));
 // Constrain the smoothed position so the camera cannot linger across a wall.
 constrainCamera(camera.position);
 const visibleOffset=clamp((camera.position.x-state.x)*yawZ-(camera.position.z-state.z)*yawX,-shoulder,shoulder)*.84;
 const bob=motion?Math.cos(gaitPhase*2)*gaitBlend*.023:0;
 cameraLook.set(state.x+yawZ*visibleOffset,2.17+bob,state.z-yawX*visibleOffset);
 camera.lookAt(cameraLook);
 playerVisual.visible=camera.position.distanceToSquared(cameraPivot)>1.15**2;
 fieldFlashlight.position.set(state.x,2.22,state.z);
 fieldFlashlightTarget.position.set(state.x-Math.sin(cameraYaw)*12,1.55,state.z-Math.cos(cameraYaw)*12);
 fieldFlashlightTarget.updateMatrixWorld();
}
function togglePerf(){
 $("perf-panel").hidden=!$("perf-panel").hidden;
 if(!$("perf-panel").hidden)updatePerfReadout();
}
function currentMetrics(){
 const sample=summarizeFrames(qaFrameMs);
 return {...sample,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
 geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
 pointLightsActive:localLights.filter(l=>l.visible).length,pointLightsTotal:localLights.length,
 pixelRatio:renderer.getPixelRatio(),width:innerWidth,height:innerHeight,
 quality:qualityMode,renderTier,shadows:renderer.shadowMap.enabled,build:"reconstruction-v0.13.1",photoAssets:surfaces.status()};
}
function updatePerfReadout(){
 if($("perf-panel").hidden)return;
 const m=currentMetrics();
 $("perf-numbers").textContent="FPS: "+m.fps+"\nFrame p95: "+m.p95Ms+" ms\nDraw calls: "+m.drawCalls+
 "\nTriangles: "+m.triangles+"\nGeometries: "+m.geometries+"\nPixel ratio: "+m.pixelRatio.toFixed(2)+" · "+m.renderTier;
}
function exportPerformanceReport(){
 if(!state.started){toast("START THE GAME FIRST");return;}
 const report={createdAt:new Date().toISOString(),source:"local in-browser sampling",
  statement:"Not a GPU profiler. Includes device viewport and local browser frame timings.",
  metrics:currentMetrics(),framesMs:[...qaFrameMs]};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=url;link.download="ashford-v0131-performance.json";
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
 toast("LOCAL PERFORMANCE REPORT SAVED");
}
function roomAtPlayer(){return ENTRANCES.findIndex(({left,right,back,front})=>state.x>left&&state.x<right&&state.z>back&&state.z<front);}
function updateSceneGrade(room){
 const zone=renderTier==="quality"&&sceneGrade?(["safehouse","market","clinic"][room]??"street"):"neutral";
 if(gradeZone===zone)return;
 gradeZone=zone;
 const {exposure,sky,ground}=sceneGrades[zone];
 renderer.toneMappingExposure=exposure;
 hemi.color.setHex(sky);hemi.groundColor.setHex(ground);
}
function applySurfaceDetail(){
 const active=renderTier==="quality"&&fineSurfaces&&(renderer.capabilities.isWebGL2||renderer.extensions.has("OES_standard_derivatives"));
 surfaces.setDetail(active);
 for(const {material,map,relief} of finishMaterials){
  const bump=active&&!material.userData.photoSurface?map:null;
  if(material.bumpMap!==bump){material.bumpMap=bump;material.bumpScale=relief;material.needsUpdate=true;}
 }
}
function applyRenderTier(tier){
 renderTier=tier;
 const preset=graphicsPresets[tier];
 renderer.setPixelRatio(Math.min(devicePixelRatio,preset.pixelRatio));
 renderer.shadowMap.enabled=preset.shadows;
 const shadowCamera=moon.shadow.camera;
 const shadowWidth=tier==="balanced"?37:70,shadowHeight=tier==="balanced"?32:60;
 shadowCamera.left=-shadowWidth;shadowCamera.right=shadowWidth;
 shadowCamera.bottom=-shadowHeight;shadowCamera.top=shadowHeight;
 shadowCamera.updateProjectionMatrix();
 const quality=tier==="quality";
 scene.background=tier==="performance"?performanceSky:skyTexture;
 scene.environment=quality?skyTexture:null;
 const anisotropy=quality?Math.min(renderer.capabilities.getMaxAnisotropy(),8):1;
 for(const {map} of finishMaterials){
  if(map.anisotropy!==anisotropy){map.anisotropy=anisotropy;map.needsUpdate=true;}
 }
 applySurfaceDetail();
 updateSceneGrade(roomAtPlayer());
 dustParticles.visible=preset.particles;
 updateLightBudget();
 qualityFrames=0;qualitySeconds=0;
}
function applyQuality(mode){
 qualityMode=graphicsModes.includes(mode)?mode:"auto";
 applyRenderTier(qualityMode==="auto"?"balanced":qualityMode);
 $("quality-button").textContent="GRAPHICS: "+qualityMode.toUpperCase();
 try{localStorage.setItem("ashfordGraphicsV02",qualityMode);}catch(e){}
}
function sampleGraphics(elapsed){
 if(qualityMode!=="auto"||!state.started||state.paused||state.ended||document.hidden)return;
 qualityFrames++;qualitySeconds+=elapsed;
 const windowSeconds=renderTier==="balanced"?5:12;
 if(qualitySeconds<windowSeconds)return;
 const fps=qualityFrames/qualitySeconds;
 if(renderTier==="balanced"&&fps<27)applyRenderTier("performance");
 if(renderTier==="performance"&&fps>=52)applyRenderTier("balanced");
 qualityFrames=0;qualitySeconds=0;
}
function saveGame(){try{localStorage.setItem("ashfordRebirthV01",JSON.stringify({stage:state.stage,x:state.x,z:state.z,health:state.health,stamina:state.stamina,thirst:state.thirst,hunger:state.hunger,ammo:state.ammo,hasGun:state.hasGun,supplies:state.supplies,inventory:state.inventory,kills:state.kills,waveKills:state.waveKills}));}catch(e){}}
function loadGame(){
 try{
  const raw=localStorage.getItem("ashfordRebirthV01");if(!raw)return;
  Object.assign(state,restoreCheckpoint(JSON.parse(raw),state));
  if(blocked(state.x,state.z,.35)){
   const safe=state.stage>=6?{x:44,z:-20}:state.stage>=2&&state.stage<=3?{x:-11,z:-23}:{x:-48,z:-24};
   state.x=safe.x;state.z=safe.z;
  }
  if(state.stage===7){const restoredKills=state.waveKills;startWave();state.waveKills=restoredKills;}
  playerVisual.position.set(state.x,0,state.z);
  toast("LOCAL CHECKPOINT RESTORED");
 }catch(e){console.warn("Checkpoint ignored:",e);}
}
function inventory(){
 $("inventory-items").innerHTML="";
 const items=[["CROWBAR","🛠️",1,null],["WATER","💧",state.inventory.water,"water"],["CANNED FOOD","🥫",state.inventory.food,"food"],["BANDAGE","🩹",state.inventory.bandage,"bandage"],["PISTOL","🔫",state.hasGun?1:0,null],["AMMO","▤",state.ammo,null],["MEDICAL SUPPLIES","▣",state.supplies,null]];
 for(const [name,icon,n,use]of items){
  const b=document.createElement("button");b.className="inv-cell";b.disabled=n===0;b.innerHTML='<span class="inv-icon">'+icon+'</span><span class="inv-name">'+name+'</span><span class="inv-count">'+n+(use&&n>0?" · USE":"")+"</span>";
  if(use)b.onclick=()=>{if(state.inventory[use]<=0)return;state.inventory[use]--;
   if(use==="water")state.thirst=clamp(state.thirst+42,0,100);if(use==="food")state.hunger=clamp(state.hunger+38,0,100);if(use==="bandage")state.health=clamp(state.health+40,0,100);
   tone(810,.13);toast(name+" USED");inventory();saveGame();};$("inventory-items").appendChild(b);
 }
}
function showPack(){if(!state.started||state.ended)return;closeAll();state.paused=true;inventory();$("pack-modal").classList.add("visible");}
function pause(){if(!state.started||state.ended)return;if($("pause-modal").classList.contains("visible")){resume();return;}closeAll();state.paused=true;$("pause-modal").classList.add("visible");saveGame();}
function resume(){closeAll();state.paused=false;}
function hardReset(){localStorage.removeItem("ashfordRebirthV01");location.reload();}
function start(){state.started=true;state.paused=false;$("intro").classList.remove("visible");$("hud").hidden=false;
 $("mobile-controls").hidden=!touchLayout.matches;
 sound.unlock();loadGame();setMarker();poseSurvivor(false,false);hud();}
const touchLayout=matchMedia("(any-pointer: coarse)");
function controls(){
 $("start-button").onclick=start;$("pause-button").onclick=pause;$("inventory-button").onclick=showPack;$("perf-button").onclick=togglePerf;$("light-button").onclick=toggleFlashlight;
 $("export-perf").onclick=exportPerformanceReport;
 const volume=$("sound-volume"),motion=$("camera-motion");
 const fineControl=$("fine-surfaces"),gradeControl=$("scene-grade");
 try{
  const savedVolume=localStorage.getItem("ashfordVolume");
  if(savedVolume!==null)volume.value=savedVolume;
  const savedMotion=localStorage.getItem("ashfordCameraMotion");
  if(savedMotion!==null)cameraMotion=savedMotion==="on";
  fineSurfaces=localStorage.getItem("ashfordFineSurfaces")!=="off";
  sceneGrade=localStorage.getItem("ashfordSceneGrade")!=="off";
  const checkpoint=JSON.parse(localStorage.getItem("ashfordRebirthV01")||"null");
  if(Number.isInteger(checkpoint?.stage)&&checkpoint.stage>=0&&checkpoint.stage<stages.length){
   $("start-button").firstChild.textContent="CONTINUE CAMPAIGN ";
  }
 }catch{}
 fineControl.checked=fineSurfaces;gradeControl.checked=sceneGrade;
 fineControl.onchange=()=>{
  fineSurfaces=fineControl.checked;applySurfaceDetail();
  try{localStorage.setItem("ashfordFineSurfaces",fineSurfaces?"on":"off");}catch{}
 };
 gradeControl.onchange=()=>{
  sceneGrade=gradeControl.checked;updateSceneGrade(roomAtPlayer());
  try{localStorage.setItem("ashfordSceneGrade",sceneGrade?"on":"off");}catch{}
 };
 sound.setVolume(Number(volume.value)/100);
 const showMotionSetting=()=>{motion.setAttribute("aria-pressed",String(cameraMotion));motion.textContent=cameraMotion?"CAMERA MOTION ON":"CAMERA MOTION OFF";};
 showMotionSetting();
 volume.addEventListener("input",()=>{
  sound.unlock();sound.setVolume(Number(volume.value)/100);
  try{localStorage.setItem("ashfordVolume",volume.value);}catch{}
 });
 motion.onclick=()=>{
  cameraMotion=!cameraMotion;showMotionSetting();
  try{localStorage.setItem("ashfordCameraMotion",cameraMotion?"on":"off");}catch{}
 };
 $("resume").onclick=resume;$("restart").onclick=hardReset;$("end-restart").onclick=hardReset;
 $("quality-button").onclick=()=>applyQuality(graphicsModes[(graphicsModes.indexOf(qualityMode)+1)%graphicsModes.length]);
 try{qualityMode=localStorage.getItem("ashfordGraphicsV02")||"auto";}catch(e){}
 applyQuality(qualityMode);
 $("close-pack").onclick=()=>{closeAll();state.paused=false;};
 $("mobile-interact").onclick=interact;$("mobile-attack").onclick=melee;$("mobile-fire").onclick=shoot;$("mobile-dodge").onclick=dodge;
 const sprintButton=$("mobile-sprint");
 let sprintId=null;
 sprintButton.addEventListener("pointerdown",e=>{
  if(sprintId!==null)return;
  e.preventDefault();sprintId=e.pointerId;touch.sprint=true;
  sprintButton.setPointerCapture(e.pointerId);
 });
 function releaseSprint(e){if(e.pointerId===sprintId){sprintId=null;touch.sprint=false;}}
 for(const evt of ["pointerup","pointercancel","lostpointercapture"])sprintButton.addEventListener(evt,releaseSprint);
 addEventListener("keydown",e=>{
 if(e.target instanceof HTMLInputElement&&e.code!=="Escape")return;
 if(e.code==="Space"&&e.target instanceof HTMLButtonElement&&(!state.started||state.paused))return;
 keys[e.code]=true;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
 // Exact keyboard turn increments, independent of low software-renderer FPS.
 // Native repeated keydown events provide smooth held-key turning on hardware.
 if((e.code==="KeyQ"||e.code==="KeyR")&&state.started&&!state.paused&&!state.ended){
  cameraYaw+=e.code==="KeyQ"?.12:-.12;
  e.preventDefault();return;
 }
 if(e.repeat)return;
 if(e.code==="Escape"){if($("pack-modal").classList.contains("visible")){resume();return;}if(activeDialog)return;pause();}
 if(e.code==="KeyI"){if($("pack-modal").classList.contains("visible"))resume();else showPack();}
 if(e.code==="KeyE")interact();if(e.code==="KeyF")shoot();if(e.code==="KeyP")togglePerf();if(e.code==="KeyL")toggleFlashlight();if(e.code==="KeyX")dodge();if(e.code==="Space")melee();
 });
 addEventListener("keyup",e=>{keys[e.code]=false;});
 const canvas=renderer.domElement;
 canvas.addEventListener("pointerdown",e=>{if(lastPointer||!state.started||state.paused||e.target!==canvas)return;lastPointer={x:e.clientX,y:e.clientY,dx:0,dy:0,id:e.pointerId,button:e.button};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener("pointermove",e=>{if(!lastPointer||lastPointer.id!==e.pointerId)return;const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;
 lastPointer.dx+=Math.abs(dx);lastPointer.dy+=Math.abs(dy);cameraYaw=clamp(cameraYaw-dx*.005,-Math.PI*40,Math.PI*40);cameraPitch=clamp(cameraPitch+dy*.003,.32,1.05);
 lastPointer.x=e.clientX;lastPointer.y=e.clientY;});
 canvas.addEventListener("pointerup",e=>{if(!lastPointer||lastPointer.id!==e.pointerId)return;if(lastPointer.dx+lastPointer.dy<10&&!matchMedia("(pointer:coarse)").matches){if(e.button===0)melee();if(e.button===2)shoot();}lastPointer=null;});
 for(const evt of ["pointercancel","lostpointercapture"])canvas.addEventListener(evt,e=>{
  if(lastPointer?.id===e.pointerId)lastPointer=null;
 });
 canvas.addEventListener("contextmenu",e=>e.preventDefault());
 const joy=$("joystick"),stick=joy.querySelector(".stick");let joyId=null;
 joy.addEventListener("pointerdown",e=>{if(joyId!==null)return;e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});
 joy.addEventListener("pointermove",e=>{if(e.pointerId===joyId)moveJoy(e);});
 function releaseJoy(e){if(e.pointerId!==joyId)return;joyId=null;touch.x=touch.y=0;stick.style.transform="translate(0,0)";}
 for(const evt of ["pointerup","pointercancel","lostpointercapture"])joy.addEventListener(evt,releaseJoy);
 function moveJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const x=e.clientX-cx,y=e.clientY-cy,len=Math.max(1,Math.hypot(x,y)),m=Math.min(len,46);touch.x=x/len*m/46;touch.y=y/len*m/46;stick.style.transform="translate("+touch.x*38+"px,"+touch.y*38+"px)";}
 function clearInput(){
  for(const key in keys)keys[key]=false;
  releaseJoy({pointerId:joyId});releaseSprint({pointerId:sprintId});lastPointer=null;
  qualityFrames=0;qualitySeconds=0;
 }
 addEventListener("blur",clearInput);
 touchLayout.addEventListener("change",()=>{
  $("mobile-controls").hidden=!state.started||!touchLayout.matches;
  clearInput();
 });
 addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
 const saveIfPlaying=()=>{if(state.started&&!state.ended)saveGame();};
 document.addEventListener("visibilitychange",()=>{if(document.hidden){clearInput();saveIfPlaying();}});
 addEventListener("pagehide",saveIfPlaying);
}
// Test-only control surface: never exposed on GitHub Pages or public production.
function installLocalQA(){
 if(location.hostname!=="127.0.0.1"||new URLSearchParams(location.search).get("__qa")!=="1")return;
 Object.defineProperty(window,"__ashfordQA",{configurable:false,value:Object.freeze({
  snapshot(){return {stage:state.stage,health:state.health,stamina:state.stamina,dodgeCooldown:state.dodgeCooldown,dodgeTime:state.dodgeTime,ammo:state.ammo,hasGun:state.hasGun,supplies:state.supplies,waveKills:state.waveKills,ended:state.ended,x:state.x,z:state.z,cameraYaw,inventory:{...state.inventory},enemies:enemies.filter(e=>!e.dead).map(e=>({type:e.type,x:e.x,z:e.z,hp:e.hp,max:e.max,ambush:e.ambush,intent:e.attackIntent?.kind||null,windup:e.windup}))};},
  perf(){const frames=[...qaFrameMs].sort((a,b)=>a-b);const n=frames.length,avg=n?frames.reduce((x,y)=>x+y,0)/n:0;
   return {sampleCount:n,averageFPS:avg?1000/avg:null,p50FrameMs:n?frames[Math.floor(n*.5)]:null,p95FrameMs:n?frames[Math.min(n-1,Math.floor(n*.95))]:null,
     drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
     pointLightsActive:localLights.filter(l=>l.visible).length,pointLightsTotal:localLights.length,pixelRatio:renderer.getPixelRatio(),
     quality:qualityMode,renderTier,shadows:renderer.shadowMap.enabled,materialSheet:Boolean(materialTile),
     surfaceRelief:finishMaterials.some(({material})=>Boolean(material.bumpMap)),skyReflections:scene.environment===skyTexture,
     photoAssets:surfaces.status(),marketShelf:Boolean(marketShelf?.visible),sceneGrade:gradeZone};
  },
  noDamage(on){state.qaNoDamage=Boolean(on);},
  combatSetup(type="walker",range=6){
   if(!Object.hasOwn(INFECTED,type)||!Number.isFinite(range)||range<1||range>12)throw Error("Invalid combat fixture");
   for(const e of enemies)removeEnemy(e);enemies.length=0;
   state.stage=7;state.waveStarted=true;state.waveKills=0;state.waveTimer=-1000;
   state.hasGun=true;state.ammo=90;state.health=100;state.qaNoDamage=true;
   state.x=0;state.z=0;state.angle=Math.PI;cameraYaw=Math.PI;
   state.attackTime=0;state.shootTime=0;state.hitTime=0;state.meleeAnim=0;state.pistolAnim=0;
   playerVisual.position.set(state.x,0,state.z);playerVisual.rotation.y=state.angle;
   spawnEnemy(type,0,range,true);enemies.at(-1).cd=.4;setMarker();
  },
  combatAdd(type,range=6){
   if(state.stage!==7||!Object.hasOwn(INFECTED,type)||!Number.isFinite(range)||range<1||range>12)throw Error("Invalid combat fixture");
   spawnEnemy(type,0,range,true);enemies.at(-1).cd=.4;
  },
  teleport(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))throw new Error("Invalid QA location");state.x=clamp(x,-73,73);state.z=clamp(z,-54,43);playerVisual.position.set(state.x,0,state.z);},
  referenceView(x,z,yaw=0,stage=6,facing=yaw){
   if(![x,z,yaw,facing].every(Number.isFinite)||!Number.isInteger(stage)||stage<0||stage>=stages.length)throw Error("Invalid local screenshot view");
   if(state.stage===7)throw Error("Do not reposition during clinic defense");
   state.stage=stage;state.x=clamp(x,-73,73);state.z=clamp(z,-54,43);state.angle=facing;cameraYaw=yaw;
   playerVisual.position.set(state.x,0,state.z);playerVisual.rotation.y=facing;
   refreshObjective();setMarker();updateLightBudget();updateCamera(1);
  },
  finishWave(){if(state.stage!==7)throw new Error("Clinic assault is not active");
   for(const enemy of [...enemies].filter(e=>e.ambush&&!e.dead).slice(0,4)){hurtEnemy(enemy,enemy.hp+1);}
  }
 })});
}
const clock=new THREE.Clock();let mapElapsed=.1;
const qaFrameMs=[];let perfPanelElapsed=0;
function animate(){
 requestAnimationFrame(animate);
 // Simulate up to 250 ms of wall-clock time using small steps so weak GPUs
 // don't slow player movement or tunnel through thin walls.
 const elapsed=Math.max(.001,clock.getDelta());
 const frameDt=Math.min(elapsed,.25);
 if(state.started&&!state.paused&&!state.ended){
  qaFrameMs.push(elapsed*1000);if(qaFrameMs.length>180)qaFrameMs.shift();
  const count=Math.max(1,Math.ceil(frameDt/.045)),dt=frameDt/count;
  for(let step=0;step<count&&state.started&&!state.paused&&!state.ended;step++){
   state.time+=dt;state.lastSave+=dt;
   updatePlayer(dt);
   if(!state.ended){updateEnemies(dt);updateEffects(dt);}
  }
  if(!state.ended&&state.lastSave>12){saveGame();state.lastSave=0;}
  mapElapsed+=frameDt;
  if(mapElapsed>=.085){hud();drawMap();mapElapsed=0;}
 }
 if(marker){markerRing.rotation.z+=frameDt*.8;markerDiamond.rotation.y+=frameDt*.75;markerDiamond.position.y=2.65+Math.sin(performance.now()*.002)*.11;}
 updateCamera(frameDt);
 const room=roomAtPlayer();
 updateSceneGrade(room);
 sound.ambience(room>=0,state.started&&!state.paused&&!state.ended&&!document.hidden);
 lightBudgetElapsed+=frameDt;
 if(lightBudgetElapsed>=.38){updateLightBudget();lightBudgetElapsed=0;}
 renderer.render(scene,camera);
 perfPanelElapsed+=elapsed;if(perfPanelElapsed>.9){updatePerfReadout();perfPanelElapsed=0;}
 sampleGraphics(elapsed);
}
try{
 materialTile=await loadMaterials();
 const textile=detailedMaterial(1,1,1,1,0xb1ae86,.94,.019);
 if(textile){packCloth.map.dispose();packCloth.dispose();packCloth=textile;}
 makeWorld();playerVisual=humanoid("player");playerVisual.position.set(state.x,0,state.z);world.add(playerVisual);playerShadow=attachContactShadow(world,state.x,state.z);
 createNPC("mara",-14,-27,Math.PI);createNPC("vale",48.9,-30.75,Math.PI);createNPC("guard",40.2,-31.1,Math.PI*.85);
 updateLightBudget();spawnAmbient();makeMarker();setMarker();controls();installLocalQA();world.updateMatrixWorld(true);updateCamera(1);animate();
 void surfaces.loadColors();
 $("loader").classList.add("hide");setTimeout(()=>$("loader").remove(),600);
}catch(err){$("loader").innerHTML='<h2>ASHFORD COULD NOT LOAD</h2><p style="max-width:420px;text-align:center;padding:12px">Check your WebGL support and internet connection. '+String(err.message).replace(/</g,"&lt;")+"</p>";console.error(err);}
