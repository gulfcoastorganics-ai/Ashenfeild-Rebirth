import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
import {isBlocked as isBlocked2D,lineBlocked as hasCover,chaseGoal as chooseChaseGoal,findPath as findRoute,restoreCheckpoint} from "./nav.mjs";
import {WEAPONS,INFECTED,ATTACK_RANGE,SPIT_RANGE,chooseTarget,applyHit,chooseInfectedAction,attackStillValid} from "./combat.mjs";
import {DODGE,canDodge,normalize2D,summarizeFrames} from "./survival.mjs";

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
scene.background=new THREE.Color(0x252e32);
scene.fog=new THREE.FogExp2(0x2e393c,.013);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,210);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.10;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$("game").appendChild(renderer.domElement);
const hemi=new THREE.HemisphereLight(0x98acb5,0x252219,1.4);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xddd5c1,1.8);moon.position.set(-21,40,22);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-70;moon.shadow.camera.right=70;moon.shadow.camera.top=60;moon.shadow.camera.bottom=-60;moon.shadow.bias=-.0004;scene.add(moon);
const world=new THREE.Group();scene.add(world);
const obstacles=[],enemies=[],effects=[],lamps=[],localLights=[];
let lightBudgetElapsed=0;
let playerVisual,playerShadow,marker,markerRing,markerDiamond;
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
const sleeveGeometry=new THREE.CylinderGeometry(.15,.18,.8,8);
const trouserGeometry=new THREE.CylinderGeometry(.17,.19,.87,9);
const jacketTorsoGeometry=new THREE.CylinderGeometry(.49,.35,1.05,10);
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
function batchStaticProps(){
 const collisionMeshes=new Set(solidMeshes);
 const batches=new Map();
 for(const prop of world.children){
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
  world.remove(...props);
  world.add(batch);
 }
}
function cyl(x,y,z,r,depth,material,group=world){const m=mesh(unitCylinder,material,x,y,z,group);m.scale.set(r,depth,r);m.castShadow=true;return m}
function sphere(x,y,z,r,material,group=world){const m=mesh(unitSphere,material,x,y,z,group);m.scale.setScalar(r);m.castShadow=true;return m}
function addLight(x,y,z,color,intensity,distance){const l=new THREE.PointLight(color,intensity,distance,2);l.position.set(x,y,z);world.add(l);localLights.push(l);return l;}
function updateLightBudget(){
 for(const l of localLights){
  const limit=Math.max(24,l.distance+12);
  l.visible=Math.hypot(l.position.x-state.x,l.position.z-state.z)<limit;
 }
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
 const tile=matUnique(0xffffff);tile.map=theme==="clinic"?referenceClinicFloor():interiorFloorTexture(w,d,theme);tile.needsUpdate=true;
 // Lift interior finish above the base world ground to eliminate coplanar depth fighting.
 box(cx,.057,cz,w,.028,d,tile);
 if(back)wall(cx,backZ,w,.7,4.9,color);
 wall(left,cz,.7,d,4.9,color);wall(right,cz,.7,d,4.9,color);
 if(doorX-frontGap/2>left)wall((left+doorX-frontGap/2)/2,frontZ,doorX-frontGap/2-left,.7,4.9,color);
 if(doorX+frontGap/2<right)wall((right+doorX+frontGap/2)/2,frontZ,right-(doorX+frontGap/2),.7,4.9,color);
 box(cx,4.85,backZ+.35,w,.23,.35,dark);
 return {frontZ,backZ,left,right};
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
 return new THREE.MeshStandardMaterial({map,roughness:.48,metalness:.15});
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
function makeWorld(){
 // Single reusable 256px procedural roadway texture; detail without external assets.
 asphalt.map=gritTexture();asphalt.color.set(0xffffff);asphalt.needsUpdate=true;
 floor(0,0,160,140,mat(0x343d36));
 // Asphalt, sidewalk, gutters, and lane paint
 floor(0,0,145,16,asphalt);floor(0,-10,145,4,concrete);floor(0,10,145,4,concrete);
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
 house({cx:-49,cz:-26,w:25,d:23,frontGap:7,doorX:-47,color:wornSurface(0x505452,121),theme:"safehouse"});
 const hSign=label("SAFEHOUSE // 01",8,1.35,"#343332","#cbb79a",56);hSign.position.set(-49,4.4,-13.60);world.add(hSign);
 const safeLamp=box(-49,4.73,-19.2,1.9,.13,.38,matUnique(0xf3d7a3));
 safeLamp.material.emissive=new THREE.Color(0xf2b977);safeLamp.material.emissiveIntensity=.45;
 addLight(-48,3.7,-24,0xffd1a0,7,20);
 box(-54,.62,-30,3,1.2,2,dark,true);box(-40,.6,-32,1.8,1.1,1.6,mat(0x6a5844));
 windowPanel(-56,2.45,-14.32,2.9,1.9);
 for(let i=0;i<3;i++)box(-56+i*.8,2.5,-14.1,.1,2.4,.12,mat(0x6a5842));
 box(-47,2.3,-13.65,5.8,3.9,.12,mat(0x343c39,.95),false).visible=false;
 // market
 house({cx:-11,cz:-26,w:26,d:24,frontGap:9,doorX:-11,color:wornSurface(0x60594d,229),theme:"market"});
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
   box(x,1.0,z,1.35,2.0,3.0,mat(0x454840));
   for(let row=0;row<3;row++){box(x,1.68-row*.55,z,1.5,.12,3.12,mat(0x6a6554));
    for(let k=0;k<4;k++)stockGroups[(row+k)%4].push({
      x:x+rand(-.32,.32),y:1.85-row*.55,z:z-1.1+k*.72,
      w:.32,h:.32,d:.25,rot:rand(-.2,.2)
    });
   }
  }
 }
 stockGroups.forEach((items,i)=>instanced(items.length,mat(stockColors[i]),j=>items[j]));
 box(-7,.5,-29,1.3,1,1.3,mat(0x6b6049));box(-7,1.03,-29,1.35,.11,1.35,mat(0xa28a5b));
 addLight(-15,3.65,-27,0xffae6a,12,21);
 addLight(-5,4,-21,0xc39159,3.4,15);
 for(let z of [-27,-34]){const fixture=box(-11,4.70,z,2.35,.14,.31,matUnique(0xd4bc8a));fixture.material.emissive=new THREE.Color(0x86562c);fixture.material.emissiveIntensity=.7;}
 // Clinic
 house({cx:45,cz:-26,w:31,d:26,frontGap:10,doorX:44,color:wornSurface(0x768080,331),theme:"clinic"});
 const clinicSign=label("ASHFORD CLINIC",20,2.15,"#253b43","#b8dce0",75);clinicSign.position.set(45,4.4,-12.65);world.add(clinicSign);
 windowPanel(34,2.3,-12.65,4,2.5);windowPanel(56,2.3,-12.65,4,2.5);
 for(let x of [34,55])box(x,3.66,-12.54,5.5,.20,.09,mat(0x4b6d71));
 box(44,.12,-12.3,8,.03,.65,mat(0xc1bb9f));
 const redCross=label("+",2.6,2.3,"#e7ded5","#ab3732",140);redCross.position.set(45,6.45,-12.8);world.add(redCross);
 // Reference-guided interior: grimy off-white upper wall, deep hospital teal belt and gray kick panel.
 // All panels are decorative; collision still uses the original solid house walls.
 const clinicTeal=wornSurface(0x153d46,427,4,1),clinicUpper=wornSurface(0x989b8f,428,4,1);
 const clinicLower=wornSurface(0x676961,429,5,1),trim=mat(0x343a32),door=wornSurface(0x4b6565,430,1,1);
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
 // Triage counter and red first aid container on the right.
 box(56,1.04,-32.8,5.0,2.0,1.85,wornSurface(0x4c4437,193,2,1));
 box(56,2.09,-32.8,5.15,.13,2.02,mat(0x8a7960));
 for(const x of [54.4,56,57.6]){
  box(x,1.22,-31.86,1.42,1.42,.095,mat(0x4a5042));
  box(x,1.78,-31.795,.67,.06,.035,medHandle);
 }
 box(56.8,2.4,-32.9,.77,.49,.58,mat(0x932b2b));
 box(56.8,2.69,-32.6,.15,.31,.035,mat(0xe4dfcf));
 box(56.8,2.69,-32.6,.42,.095,.04,mat(0xe4dfcf));
 box(56.8,2.69,-32.91,.32,.075,.11,trim);
 // Low-cost dropped rubble to break up the perfectly clean floor without blocking the mission corridor.
 const rubbleMat=mat(0x8d816a),paperMat=mat(0xaaa48d);
 instanced(24,rubbleMat,i=>({x:32+(i*17%26),y:.123,z:-36+(i*11%21),w:.11+(i%4)*.065,h:.048,d:.17+(i%3)*.04,rot:i*.61}));
 instanced(10,paperMat,i=>({x:33+(i*7%25),y:.119,z:-34+(i*5%19),w:.34,h:.015,d:.23,rot:i*.8}));
 // Clinic wayfinding
 for(let z of [-30,-22]){const strip=box(43,.089,z,15,.014,.15,mat(0x9bafad));}
 for(let x of [34,53]){for(let z of [-33,-24]){box(x,.42,z,3,.8,1,mat(0x697b79),true);
 box(x,1.04,z,3,.09,1,mat(0x909f9b));
 for(let j=-1;j<=1;j++)cyl(x+j*.65,1.35,z,.14,.5,mat(0x8a9998));
 }}
 // Reuse simple geometry as recognizable clinic details without new mesh imports.
 const medCabinet=mat(0x87938e),medTrim=mat(0xb8c4bd),red=mat(0x9b443e);
 for(const [x,z] of [[39,-36],[50,-35],[35,-19],[56,-20]]){
   box(x,2.0,z,1.35,1.55,.40,medCabinet);
   box(x,2.75,z,1.4,.11,.47,medTrim);
   box(x,2.0,z-.23,.18,.65,.06,red);
   box(x,2.0,z-.24,.65,.18,.07,red);
 }
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
 const ward=label("WARD B / TRIAGE",4.6,.36,"#414238","#d5cdb5",50);ward.position.set(56,1.56,-31.78);world.add(ward);
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
function makeCar(x,z,color,police=false){
 const car=new THREE.Group();car.position.set(x,0,z);world.add(car);
 box(0,.63,0,4.6,.7,2.1,mat(color,.48,.35),false,car);
 box(-.2,1.12,0,2.5,.67,1.86,glass,false,car);
 box(-.18,1.42,0,2.1,.09,1.82,dark,false,car);
 for(let dx of [-1.45,1.45])for(let dz of [-1,1]){const wheel=cyl(dx,.4,dz,.39,.20,coal,car);wheel.rotation.x=Math.PI/2;}
 box(2.28,.67,-.7,.07,.21,.5,mat(0xf2ddad),false,car);box(2.28,.67,.7,.07,.21,.5,mat(0xf2ddad),false,car);
 if(police){box(-.1,1.53,0,1.0,.16,.27,mat(0x2a2e31),false,car);box(-.44,1.56,0,.34,.16,.28,mat(0x315e94),false,car);box(.28,1.56,0,.34,.16,.28,mat(0x9f3f3c),false,car);
  const trim=mat(0x68706e,.66,.32),stripe=mat(0x96958b,.72,.14);
  for(const side of [-1,1]){
   box(.08,.56,side*1.055,3.25,.16,.035,stripe,false,car);
   box(-.61,.80,side*1.08,.26,.055,.041,trim,false,car);
   box(.74,.80,side*1.08,.26,.055,.041,trim,false,car);
   box(-2.31,.66,side*.72,.065,.24,.39,mat(0x723b37,.42),false,car);
  }
  box(-2.29,.43,0,.30,.17,2.03,dark,false,car);
  box(2.32,.47,0,.20,.18,1.99,dark,false,car);
  const policeSign=label("ASHFORD COUNTY",2.7,.39,"#313940","#d1d5d3",71);policeSign.position.set(.15,.78,1.079);car.add(policeSign);
 }
}
function makeTree(x,z){cyl(x,1.35,z,.25,2.7,mat(0x55483a));for(let i=0;i<3;i++)sphere(x+rand(-.6,.6),3.2+rand(-.3,.7),z+rand(-.5,.5),rand(.9,1.5),mat([0x47574d,0x59604b,0x3d4c45][i]));}
function plaidTexture(){
 const c=document.createElement("canvas");c.width=c.height=512;
 const ctx=c.getContext("2d");ctx.fillStyle="#171a1a";ctx.fillRect(0,0,512,512);
 // Screenshot reference: bright red, dense charcoal plaid with narrow dark seams.
 for(let k=0;k<512;k+=128){
  ctx.fillStyle="#8e262c";ctx.fillRect(k+4,0,63,512);ctx.fillRect(0,k+5,512,63);
  ctx.fillStyle="rgba(192,65,57,.58)";ctx.fillRect(k+18,0,9,512);ctx.fillRect(0,k+19,512,9);
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
const survivorHairShape=new THREE.SphereGeometry(1,14,9,0,Math.PI*2,0,Math.PI*.58);
const roundedGear=(()=>{
 const shape=new THREE.Shape();
 shape.moveTo(-.37,-.37);shape.lineTo(.37,-.37);shape.lineTo(.37,.37);shape.lineTo(-.37,.37);shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.74,bevelEnabled:true,bevelSize:.13,bevelThickness:.13,bevelSegments:2,steps:1,curveSegments:1});
 geometry.translate(0,0,-.37);
 return geometry;
})();
const survivorCloth=wornSurface(0x514137,926,1,1);
const packCloth=wornSurface(0x37543e,932,1,1);
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
function createSurvivor(kind){
 const outfit=civilianOutfits[kind];
 const top=outfit?.top??plaidMat,pants=outfit?.pants??survivorCloth;
 const group=new THREE.Group();
 const torso=new THREE.Group();torso.position.y=1.13;group.add(torso);
 const head=new THREE.Group();head.position.set(0,1.26,-.015);torso.add(head);
 const skin=outfit?.skin??mat(0xaa8065),boot=mat(kind==="vale"?0x77786c:0x392d20),sole=mat(0x242321),edge=mat(0x252d23),straps=mat(0x55624b),metal=mat(0x888374,.56,.5);
 function shaped(geometry,material,parent,x,y,z,sx,sy,sz){
  const part=mesh(geometry,material,x,y,z,parent);
  part.scale.set(sx,sy,sz);part.castShadow=true;
  return part;
 }
 shaped(jacketShape,top,torso,0,0,0,.45,1,.27);
 shaped(neckShape,skin,torso,0,1.01,0,.135,1,.13);
 shaped(unitSphere,skin,head,0,0,-.027,.227,.312,.235);
 shaped(unitSphere,skin,head,0,-.13,-.07,.181,.17,.173);
 shaped(survivorHairShape,hairCloth,head,0,.045,.012,.237,.324,.241).rotation.x=-.17;
 shaped(unitSphere,hairCloth,head,0,-.09,.178,.151,.075,.064);
 shaped(unitSphere,skin,head,0,-.02,-.247,.054,.078,.055);
 for(const side of [-1,1]){
  shaped(unitSphere,skin,head,.221*side,-.04,.005,.038,.076,.046);
  box(.091*side,.037,-.238,.067,.024,.025,mat(0x392d27),false,head);
 }
 shaped(roundedGear,pants,group,0,1.13,.009,.66,.28,.42);
 const limbs=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.437,.83,0);torso.add(arm);
  shaped(sleeveShape,top,arm,side*.067,-.77,0,.149,1,.142).rotation.z=side*.10;
  shaped(unitSphere,skin,arm,side*.09,-.849,-.016,.071,.127,.063);
  shaped(unitSphere,skin,arm,side*.042,-.82,-.055,.035,.069,.046);
  limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.185,1.12,.023);group.add(leg);
  shaped(trouserShape,pants,leg,0,-.92,0,.185,1,.173);
  shaped(roundedGear,boot,leg,0,-.939,-.079,.263,.252,.422);
  box(0,-1.054,-.085,.27,.066,.436,sole,false,leg);
  limbs.push(leg);
 }
 if(kind==="player"){
  shaped(roundedGear,packCloth,torso,0,.52,.402,.665,.96,.425);
  shaped(roundedGear,edge,torso,0,.489,.623,.533,.655,.082);
  shaped(roundedGear,packCloth,torso,0,.423,.682,.482,.485,.095);
  box(0,.684,.733,.39,.031,.025,straps,false,torso);
  box(0,.925,.432,.218,.082,.098,edge,false,torso);
  for(const side of [-1,1]){
   const strap=box(side*.276,.473,-.252,.086,.824,.067,edge,false,torso);strap.rotation.z=side*.10;
   shaped(roundedGear,packCloth,torso,side*.33,.426,.412,.13,.45,.30);
   box(side*.219,.522,.722,.038,.554,.021,straps,false,torso);
   box(side*.22,.685,.738,.067,.075,.024,metal,false,torso);
  }
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
 group.userData={limbs,head,torso};
 return group;
}
function humanoid(kind){
 if(kind==="player"||Object.hasOwn(civilianOutfits,kind))return createSurvivor(kind);
 const group=new THREE.Group();
 const skin=infectedSkin;
 const fabric=infectedFabric[kind]??infectedFabric.walker;
 const pants=mat(0x48473f);
 const torso=mesh(jacketTorsoGeometry,fabric.clone(),0,1.61,0,group);torso.castShadow=true;
 box(0,1.11,0,.72,.18,.43,pants,false,group);
 const head=sphere(0,2.42,-.01,.33,skin,group);head.scale.set(.27,.363,.277);
 box(0,2.36,-.286,.071,.13,.11,skin,false,group);
 const hair=sphere(0,2.70,.0,.32,mat(0x42483e),group);hair.scale.set(.27,.12,.245);
 for(let side of [-1,1]){sphere(side*.13,2.46,-.29,.036,mat(0x1d2220),group);}
 const limbs=[];
 for(let s of [-1,1]){
  const arm=new THREE.Group();arm.position.set(s*.55,2.03,0);group.add(arm);
  const a=mesh(sleeveGeometry,fabric,0,-.38,0,arm);a.castShadow=true;a.rotation.z=s*.10;
  sphere(0,-.80,-.01,.15,skin,arm);limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(s*.23,1.05,0);group.add(leg);
  const thigh=mesh(trouserGeometry,pants,0,-.40,0,leg);thigh.castShadow=true;
  box(0,-.89,-.10,.37,.20,.55,dark,false,leg);limbs.push(leg);
 }
 if(kind==="brute"){
  group.scale.set(1.32,1.27,1.24);torso.scale.x*=1.35;head.scale.x*=1.12;
  const bulk=mat(0x655e54);
  for(const side of [-1,1]){sphere(side*.62,2.02,.02,.38,bulk,group);box(side*.60,1.63,.20,.20,.48,.20,bulk,false,group);}
 }
 if(kind==="runner"){
  torso.rotation.x=-.30;head.position.z=-.20;group.scale.set(.91,1,.92);
  limbs[0].rotation.z=.25;limbs[2].rotation.z=-.30;
  box(-.38,1.69,-.30,.25,.40,.08,mat(0x745751),false,group);
 }
 if(kind==="spitter"){
  const glow=mat(0x6b9d43);glow.emissive=new THREE.Color(0x3a9e22);glow.emissiveIntensity=.85;
  box(0,1.65,-.31,.39,.48,.11,glow,false,group);
  for(const side of [-1,1]){sphere(side*.42,1.35,-.28,.21,glow,group);}
  sphere(0,2.02,-.29,.18,glow,group);
 }
 box(0,1.57,-.29,.45,.22,.03,mat(0x482c2a),false,group);
 group.userData={limbs,head,torso};
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
function tone(freq=440,dur=.12,type="sine",volume=.04){
 try{const ac=tone.ctx||(tone.ctx=new (window.AudioContext||window.webkitAudioContext)());if(ac.state==="suspended")ac.resume();
 const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,ac.currentTime);
 o.frequency.exponentialRampToValueAtTime(Math.max(freq*.67,20),ac.currentTime+dur);
 g.gain.setValueAtTime(volume,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+dur);}catch(e){}
}
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
function takeDamage(amount){if(state.qaNoDamage||state.hitTime>.05||state.dodgeIFrames>0)return;state.health=clamp(state.health-amount,0,100);state.hitTime=.45;$("damage-flash").style.opacity=.75;tone(120,.22,"sawtooth",.09);setTimeout(()=>$("damage-flash").style.opacity=0,130);if(state.health<=0)gameOver();}
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
 toast("DODGE");tone(280,.10,"triangle",.055);
}
function melee(){
 if(state.attackTime>0||!state.started||state.paused)return;
 state.attackTime=WEAPONS.crowbar.cooldown;state.meleeAnim=WEAPONS.crowbar.cooldown;
 tone(175,.1,"triangle",.06);
 const p=pos(),facing=aimDirection();
 const target=chooseTarget(p,{x:facing.x,z:facing.z},enemies,"crowbar",obstacles);
 if(target)hurtEnemy(target,WEAPONS.crowbar.damage,"crowbar");
 const slash=mesh(new THREE.TorusGeometry(1.15,.045,5,25,Math.PI*.86),
  new THREE.MeshBasicMaterial({color:0xe9d6b6,transparent:true,opacity:.84}),
  state.x+facing.x*.8,1.5,state.z+facing.z*.8,world);
 slash.rotation.set(.35,-state.angle,0);
 effects.push({mesh:slash,life:.24,total:.24,kind:"fade"});
}
function shoot(){
 if(!state.started||state.paused||state.shootTime>0)return;
 if(!state.hasGun){toast("FIND A FIREARM FIRST");return;}
 if(state.ammo<=0){toast("OUT OF AMMO — USE MELEE");tone(180,.05);return;}
 state.ammo--;state.shootTime=WEAPONS.pistol.cooldown;
 state.pistolAnim=.28;state.cameraKick=Math.max(state.cameraKick,.18);
 tone(65,.25,"sawtooth",.17);tone(340,.06,"triangle",.08);
 const facing=aimDirection();
 const target=chooseTarget(pos(),{x:facing.x,z:facing.z},enemies,"pistol",obstacles);
 const src=V(state.x+facing.x*.7,1.75,state.z+facing.z*.7);
 const end=target?V(target.x,1.7,target.z):src.clone().addScaledVector(facing,24);
 if(target)hurtEnemy(target,WEAPONS.pistol.damage,"pistol");
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([src,end]),
  new THREE.LineBasicMaterial({color:0xf9d38e,transparent:true,opacity:.95}));
 world.add(line);effects.push({mesh:line,life:.12,total:.12,kind:"fade"});
 const flash=sphere(src.x,src.y,src.z,.23,new THREE.MeshBasicMaterial({color:0xffde8c,transparent:true,opacity:1}));
 effects.push({mesh:flash,life:.09,total:.09,kind:"fade"});
}
function hurtEnemy(e,damage,weapon="pistol"){
 if(e.dead||e.hp<=0)return;
 const hit=applyHit(e.hp,damage);e.hp=hit.health;
 e.hitFlash=.18;e.stagger=e.type==="brute"?.13:.22;
 if(e.type!=="brute"&&e.attackIntent){e.attackIntent=null;e.cd=Math.max(e.cd,.35);}
 tone(330,.07,"square",.035);confirmHit(hit.killed);
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
   e.death-=dt;e.mesh.rotation.z=Math.min(1.4,e.mesh.rotation.z+dt*2.3);
   e.mesh.position.y=-Math.max(0,1.7-e.death)*.20;
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
  e.mesh.position.set(e.x,Math.sin(e.phase)*.025,e.z);
  animateLimbs(e.mesh,Math.sin(e.phase)*(attacking?.16:.56));
  const torso=e.mesh.userData.torso;
  const windup=e.attackIntent?Math.sin(Math.PI*(1-e.windup/e.attackIntent.windup)):.0;
  torso.rotation.x=(e.type==="runner"?-.30:0)+windup*(e.type==="brute"?.42:e.type==="spitter"?-.55:.23);
  e.mesh.userData.head.rotation.x=-windup*.12;
  torso.material.emissive.setHex(e.hitFlash>0?0x6b2616:0x000000);
  torso.material.emissiveIntensity=e.hitFlash>0?1.15:0;
 }
}
function animateLimbs(char,amount){const limbs=char.userData.limbs;if(!limbs)return;limbs[0].rotation.x=amount*.48;limbs[1].rotation.x=-amount*.65;limbs[2].rotation.x=-amount*.48;limbs[3].rotation.x=amount*.65;}

function poseSurvivor(moving,sprinting){
 const {limbs,head,torso}=playerVisual.userData;
 if(!limbs)return;
 // Additive animation over original four pivot groups: no replacement skeleton.
 torso.rotation.x=sprinting?-.13:moving?-.035:Math.sin(state.time*1.7)*.012;
 torso.rotation.z=moving?Math.sin(state.time*7)*.015:Math.sin(state.time*1.15)*.008;
 head.rotation.x=sprinting?.08:0;
 const swing=state.meleeAnim>0?Math.sin(Math.PI*(1-state.meleeAnim/WEAPONS.crowbar.cooldown)):0;
 const recoil=state.pistolAnim>0?Math.sin(Math.PI*(1-state.pistolAnim/.28)):0;
 limbs[2].rotation.x-=swing*1.85+recoil*.80;
 limbs[2].rotation.z=-swing*.32;
 if(state.hasGun&&!swing){limbs[2].rotation.x-=.24;limbs[0].rotation.x-=.12;}
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
 if(stepping)gaitPhase=(gaitPhase+travel*1.86)%(2*Math.PI);
 gaitBlend+=((stepping?1:0)-gaitBlend)*(1-Math.exp(-dt*13));
 playerVisual.position.set(state.x,(1-Math.cos(gaitPhase*2))*gaitBlend*.027,state.z);
 playerShadow.position.set(state.x,.085,state.z);
 playerVisual.rotation.y=state.angle;
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
 if(e.mesh.material&&"opacity"in e.mesh.material)e.mesh.material.opacity=clamp(e.life/e.total,0,1)*.9;
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
 const reach=5.0;
 const horizontal=Math.cos(cameraPitch)*reach;
 const vertical=Math.sin(cameraPitch)*reach+state.cameraKick*.85;
 cameraPivot.set(state.x,1.82,state.z);
 cameraDesired.set(state.x+yawX*horizontal+yawZ*shoulder,vertical+1.54,state.z+yawZ*horizontal-yawX*shoulder);
 camera.position.lerp(cameraDesired,1-Math.exp(-dt*8));
 // Constrain the smoothed position so the camera cannot linger across a wall.
 constrainCamera(camera.position);
 const visibleOffset=clamp((camera.position.x-state.x)*yawZ-(camera.position.z-state.z)*yawX,-shoulder,shoulder)*.84;
 cameraLook.set(state.x+yawZ*visibleOffset,1.87,state.z-yawX*visibleOffset);
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
 quality:qualityMode,renderTier,shadows:renderer.shadowMap.enabled,build:"reconstruction-v0.10"};
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
 const link=document.createElement("a");link.href=url;link.download="ashford-v010-performance.json";
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
 toast("LOCAL PERFORMANCE REPORT SAVED");
}
function applyRenderTier(tier){
 renderTier=tier;
 const preset=graphicsPresets[tier];
 renderer.setPixelRatio(Math.min(devicePixelRatio,preset.pixelRatio));
 renderer.shadowMap.enabled=preset.shadows;
 dustParticles.visible=preset.particles;
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
 loadGame();setMarker();try{tone(480,.15);}catch(e){}}
const touchLayout=matchMedia("(any-pointer: coarse)");
function controls(){
 $("start-button").onclick=start;$("pause-button").onclick=pause;$("inventory-button").onclick=showPack;$("perf-button").onclick=togglePerf;$("light-button").onclick=toggleFlashlight;
 $("export-perf").onclick=exportPerformanceReport;
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
 addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
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
     quality:qualityMode,renderTier,shadows:renderer.shadowMap.enabled};
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
  referenceView(x,z,yaw=0,stage=6){
   if(![x,z,yaw].every(Number.isFinite)||!Number.isInteger(stage)||stage<0||stage>=stages.length)throw Error("Invalid local screenshot view");
   if(state.stage===7)throw Error("Do not reposition during clinic defense");
   state.stage=stage;state.x=clamp(x,-73,73);state.z=clamp(z,-54,43);state.angle=yaw;cameraYaw=yaw;
   playerVisual.position.set(state.x,0,state.z);playerVisual.rotation.y=yaw;
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
  hud();
  if(!state.ended&&state.lastSave>12){saveGame();state.lastSave=0;}
  mapElapsed+=frameDt;
  if(mapElapsed>=.1){drawMap();mapElapsed=0;}
 }
 if(marker){markerRing.rotation.z+=frameDt*.8;markerDiamond.rotation.y+=frameDt*.75;markerDiamond.position.y=2.65+Math.sin(performance.now()*.002)*.11;}
 updateCamera(frameDt);lightBudgetElapsed+=frameDt;if(lightBudgetElapsed>=.38){updateLightBudget();lightBudgetElapsed=0;}renderer.render(scene,camera);
 perfPanelElapsed+=elapsed;if(perfPanelElapsed>.9){updatePerfReadout();perfPanelElapsed=0;}
 sampleGraphics(elapsed);
}
try{
 makeWorld();playerVisual=humanoid("player");playerVisual.position.set(state.x,0,state.z);world.add(playerVisual);playerShadow=attachContactShadow(world,state.x,state.z);
 createNPC("mara",-14,-27,Math.PI);createNPC("vale",50.2,-30.75,Math.PI);createNPC("guard",38.7,-31.1,Math.PI*.85);
 updateLightBudget();spawnAmbient();makeMarker();setMarker();controls();installLocalQA();world.updateMatrixWorld(true);updateCamera(1);animate();
 $("loader").classList.add("hide");setTimeout(()=>$("loader").remove(),600);
}catch(err){$("loader").innerHTML='<h2>ASHFORD COULD NOT LOAD</h2><p style="max-width:420px;text-align:center;padding:12px">Check your WebGL support and internet connection. '+String(err.message).replace(/</g,"&lt;")+"</p>";console.error(err);}
