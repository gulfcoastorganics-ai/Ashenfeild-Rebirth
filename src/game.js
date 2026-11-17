import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
import {isBlocked as isBlocked2D,lineBlocked as hasCover,chaseGoal as chooseChaseGoal,findPath as findRoute,restoreCheckpoint} from "./nav.mjs";
import {WEAPONS,INFECTED,chooseTarget,applyHit,chooseInfectedAction,attackStillValid} from "./combat.mjs";

/* Ashford Rebirth: wholly original reconstruction. Not recovered Sites v7.1 source. */
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const dist = (a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const mat=(color,rough=.88,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const coal=mat(0x21282a), asphalt=mat(0x292c2d), concrete=mat(0x555b57), dust=mat(0x7a7060), brick=mat(0x5f5551), panel=mat(0x6c726d), glass=mat(0x39595a,.25,.15), dark=mat(0x1b2225);
const goldMat=new THREE.MeshStandardMaterial({color:0xf1b775,emissive:0x9d5723,emissiveIntensity:.5,roughness:.3});
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x252e32);
scene.fog=new THREE.FogExp2(0x2e393c,.013);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,210);
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
const obstacles=[],enemies=[],effects=[],lamps=[];
let playerVisual,marker,markerRing;
const state={
 started:false,paused:true,ended:false,stage:0,health:100,stamina:100,thirst:80,hunger:80,
 ammo:0,mag:12,hasGun:false,supplies:0,kills:0,waveKills:0,waveStarted:false,waveTimer:0,
 x:-48,z:-24,angle:Math.PI,weapon:"crowbar",inventory:{water:1,food:2,bandage:1},
 time:0,attackTime:0,shootTime:0,hitTime:0,lastSave:0,hitConfirm:0,cameraKick:0,meleeAnim:0,pistolAnim:0
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
let cameraYaw=Math.PI,cameraPitch=.56,lastPointer=null,activeDialog=false;
let qualityMode="auto";
const solidMeshes=[];
const cameraRay=new THREE.Raycaster();

const pos=()=>({x:state.x,z:state.z});
function mesh(geom,material,x=0,y=0,z=0,group=world){const m=new THREE.Mesh(geom,material);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m}
const unitCube=new THREE.BoxGeometry(1,1,1);
function box(x,y,z,w,h,d,material,solid=false,group=world){const m=mesh(unitCube,material,x,y,z,group);m.scale.set(w,h,d);m.castShadow=h>.45;if(solid){obstacles.push({x,z,w,d});solidMeshes.push(m);}return m}
function instanced(count,material,transform){
 const group=new THREE.InstancedMesh(unitCube,material,count);
 const dummy=new THREE.Object3D();
 for(let i=0;i<count;i++){
  const data=transform(i);
  dummy.position.set(data.x,data.y,data.z);
  dummy.scale.set(data.w,data.h,data.d);
  dummy.rotation.set(0,data.rot||0,0);
  dummy.updateMatrix();group.setMatrixAt(i,dummy.matrix);
 }
 group.instanceMatrix.needsUpdate=true;group.castShadow=false;group.receiveShadow=false;
 world.add(group);return group;
}
function cyl(x,y,z,r,depth,material,group=world){const m=mesh(new THREE.CylinderGeometry(r,r,depth,9),material,x,y,z,group);m.castShadow=true;return m}
function sphere(x,y,z,r,material,group=world){const m=mesh(new THREE.SphereGeometry(r,10,8),material,x,y,z,group);m.castShadow=true;return m}
function addLight(x,y,z,color,intensity,distance){const l=new THREE.PointLight(color,intensity,distance,2);l.position.set(x,y,z);world.add(l);return l}
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
function interiorFloorTexture(w,d){
 const c=document.createElement("canvas");c.width=c.height=128;
 const ctx=c.getContext("2d");ctx.fillStyle="#55534b";ctx.fillRect(0,0,128,128);
 for(let i=0;i<13;i++){const v=i*10;ctx.strokeStyle="rgba(20,24,23,.24)";
  ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,128);ctx.moveTo(0,v);ctx.lineTo(128,v);ctx.stroke();}
 for(let i=0;i<350;i++){ctx.fillStyle=i%3===0?"rgba(179,167,142,.17)":"rgba(19,27,27,.18)";
  ctx.fillRect(rand(0,128),rand(0,128),rand(.3,2.8),rand(.3,1.5));}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(w/8,d/8);return t;
}
function house({cx,cz,w,d,frontGap=6,color=brick,doorX=cx,back=true}){
 const backZ=cz-d/2,frontZ=cz+d/2,left=cx-w/2,right=cx+w/2;
 const tile=mat(0xffffff);tile.map=interiorFloorTexture(w,d);tile.needsUpdate=true;
 floor(cx,cz,w,d,tile);
 if(back)wall(cx,backZ,w,.7,4.9,color);
 wall(left,cz,.7,d,4.9,color);wall(right,cz,.7,d,4.9,color);
 if(doorX-frontGap/2>left)wall((left+doorX-frontGap/2)/2,frontZ,doorX-frontGap/2-left,.7,4.9,color);
 if(doorX+frontGap/2<right)wall((right+doorX+frontGap/2)/2,frontZ,right-(doorX+frontGap/2),.7,4.9,color);
 box(cx,4.85,backZ+.35,w,.23,.35,dark);
 return {frontZ,backZ,left,right};
}
function windowPanel(x,y,z,w,h){box(x,y,z,w,h,.1,glass);box(x-w/2,y,z,.13,h+.2,.14,dark);box(x+w/2,y,z,.13,h+.2,.14,dark);box(x,y+h/2,z,w+.1,.13,.14,dark);box(x,y-h/2,z,w+.1,.13,.14,dark);}
function makeWorld(){
 // Single reusable 256px procedural roadway texture; detail without external assets.
 asphalt.map=gritTexture();asphalt.color.set(0xffffff);asphalt.needsUpdate=true;
 floor(0,0,160,140,mat(0x343d36));
 // Asphalt, sidewalk, gutters, and lane paint
 floor(0,0,145,16,asphalt);floor(0,-10,145,4,concrete);floor(0,10,145,4,concrete);
 box(0,.08,-8,145,.17,.32,dust);box(0,.08,8,145,.17,.32,dust);
 for(let x=-66;x<67;x+=9)box(x,.063,0,4,.018,.15,mat(0xc7b48b));
 // worn asphalt seam lines and cracks
 instanced(155,mat(0x171a1a),()=>({x:rand(-69,69),y:.066,z:rand(-7.6,7.6),w:rand(.24,1.9),h:.012,d:.025,rot:rand(-1.1,1.1)}));
 for(const shade of [0x6e6c5c,0x373d39,0x444b46])
  instanced(35,mat(shade),()=>{const size=rand(.09,.44);return {x:rand(-68,68),y:.07,z:rand(-46,39),w:size,h:.045,d:size};});
 for(let i=0;i<17;i++){const x=rand(-61,64),z=rand(-6.4,6.4);
  const puddle=mesh(new THREE.CircleGeometry(1,20),mat(0x202d31,.19,.22),x,.066,z);
  puddle.rotation.x=-Math.PI/2;puddle.scale.set(rand(.25,1.5),rand(.18,.7),1);
 }
 // Safehouse
 house({cx:-49,cz:-26,w:25,d:23,frontGap:7,doorX:-47,color:mat(0x505452)});
 const hSign=label("SAFEHOUSE // 01",8,1.35,"#343332","#cbb79a",56);hSign.position.set(-49,4.4,-13.60);world.add(hSign);
 const safeLamp=box(-48,4.42,-25,2.5,.17,.52,mat(0xf3d7a3));
 safeLamp.material.emissive=new THREE.Color(0xf2b977);safeLamp.material.emissiveIntensity=.45;
 addLight(-48,3.7,-24,0xffd1a0,7,20);
 box(-54,.62,-30,3,1.2,2,dark,true);box(-40,.6,-32,1.8,1.1,1.6,mat(0x6a5844));
 windowPanel(-56,2.45,-14.32,2.9,1.9);
 for(let i=0;i<3;i++)box(-56+i*.8,2.5,-14.1,.1,2.4,.12,mat(0x6a5842));
 box(-47,2.3,-13.65,5.8,3.9,.12,mat(0x343c39,.95),false).visible=false;
 // market
 house({cx:-11,cz:-26,w:26,d:24,frontGap:9,doorX:-11,color:mat(0x60594d)});
 const marketSign=label("LAST STOP MARKET",19,2.2,"#2d3534","#dfaa6d",78);marketSign.position.set(-11,4.35,-13.56);world.add(marketSign);
 windowPanel(-20,2.25,-13.55,4,2.4);windowPanel(-2,2.25,-13.55,4,2.4);
 // Hand-height scuffs and grime at the storefront, intentionally low-cost decals.
 const scuffMat=new THREE.MeshStandardMaterial({color:0x312b26,transparent:true,opacity:.42,depthWrite:false,roughness:1});
 for(let i=0;i<26;i++){const x=rand(-23,-18.1)+(i%2?0:rand(16,21)),y=rand(1.1,3.2);
  box(x,y,-13.48,rand(.08,.52),rand(.025,.15),.012,scuffMat);
 }
 box(-11,3.15,-13.47,9,.07,.05,mat(0x715f4c));
 // Worn panels and improvised shop notes establish detail at player height.
 for(const [x,z] of [[-21,-23],[-21,-34],[-1,-31]]){
   box(x,1.55,z,.08,1.35,1.3,mat(0x6e6455));
   box(x+.08,2.1,z,.035,.12,1.05,mat(0x9c8060));
 }
 // counter, cash register, shelves, stock
 box(-15,.82,-29,7,1.65,1.25,mat(0x594734));box(-15,1.7,-29,7,.14,1.35,mat(0x88745c));
 box(-12,1.93,-29,1.1,.45,.85,dark);box(-12,2.16,-29,.9,.09,.48,glass);
 for(let x of [-6,-2,0]){if(x===0)continue;
  for(let z of [-34,-27,-21]){if(x===-6 && z===-27)continue;
   box(x,1.0,z,1.35,2.0,3.0,mat(0x454840));
   for(let row=0;row<3;row++){box(x,1.68-row*.55,z,1.5,.12,3.12,mat(0x6a6554));
    for(let k=0;k<4;k++){const b=box(x+rand(-.32,.32),1.85-row*.55,z-1.1+k*.72,.32,.32,.25,mat([0x7f6651,0x607a71,0x958456,0x444f5d][(row+k)%4]));b.rotation.y=rand(-.2,.2);}
   }
  }
 }
 box(-7,.5,-29,1.3,1,1.3,mat(0x6b6049));box(-7,1.03,-29,1.35,.11,1.35,mat(0xa28a5b));
 addLight(-15,4.15,-27,0xffb16d,9,23);
 addLight(-5,4,-21,0xb77d44,4,15);
 for(let z of [-20,-33]){const fixture=box(-11,4.45,z,3,.18,.4,mat(0xd4bc8a));fixture.material.emissive=new THREE.Color(0x86562c);fixture.material.emissiveIntensity=.7;}
 // Clinic
 house({cx:45,cz:-26,w:31,d:26,frontGap:10,doorX:44,color:mat(0x768080)});
 const clinicSign=label("ASHFORD CLINIC",20,2.15,"#253b43","#b8dce0",75);clinicSign.position.set(45,4.4,-12.65);world.add(clinicSign);
 windowPanel(34,2.3,-12.65,4,2.5);windowPanel(56,2.3,-12.65,4,2.5);
 for(let x of [34,55])box(x,3.66,-12.54,5.5,.20,.09,mat(0x4b6d71));
 box(44,.12,-12.3,8,.03,.65,mat(0xc1bb9f));
 const redCross=label("+",2.6,2.3,"#e7ded5","#ab3732",140);redCross.position.set(45,6.45,-12.8);world.add(redCross);
 // Clinic wayfinding
 for(let z of [-30,-22]){const strip=box(43,.055,z,15,.014,.15,mat(0x9bafad));}
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
 // privacy curtains near medical beds
 for(let x of [36,54]){const curtain=box(x,2.7,-31,.07,2.65,5,mat(0x778c85,.95));curtain.material.side=THREE.DoubleSide;}
 for(let x of [38,48]){for(let z of [-34,-19]){const fixture=box(x,4.45,z,4,.16,.64,mat(0xc5d6ca));fixture.material.emissive=new THREE.Color(0x9ac1c1);fixture.material.emissiveIntensity=.7;}}
 addLight(44,4,-24,0xaddde2,6,22);addLight(54,3.8,-32,0xa7def0,4,15);
 const ward=label("WARD B   /   TRIAGE",10,1.1,"#37565d","#e1e6df",48);ward.position.set(46,2.7,-38.52);world.add(ward);
 // Patrol car, street debris and reflective safety cones form a readable landmark.
 makeCar(17,2,0x343b40,true);addLight(17,5,4,0xf0bd78,5,18);lamp(23,-8,true);
 for(const [x,z] of [[13,-2],[21,5],[23,1]]){const cone=mesh(new THREE.ConeGeometry(.33,.87,7),mat(0xa8683d),x,.5,z);cone.castShadow=true;
  cyl(x,.105,z,.42,.15,mat(0xb5ac8a));}

 // ambient street furniture
 for(let x of [-56,-27,0,34,65])lamp(x,9,x%2===0);
 for(let i=0;i<19;i++)makeTree(rand(-65,65),Math.random()>.5?rand(16,35):rand(-58,-44));
 for(let i=0;i<20;i++){let x=rand(-67,67),z=rand(11,23);if(i%3===0)z=rand(-48,-42);
 box(x,.35,z,rand(.3,1.5),rand(.4,1.2),rand(.3,1.1),mat([0x5b5b52,0x3d4848,0x796352][i%3]));}
 for(let x of [-65,69])makeCar(x,17,0x675b4e,false);
 const dustPositions=new Float32Array(240*3);
 for(let i=0;i<240;i++){dustPositions[i*3]=rand(-65,65);dustPositions[i*3+1]=rand(.4,4.5);dustPositions[i*3+2]=rand(-39,22);}
 const dustGeom=new THREE.BufferGeometry();dustGeom.setAttribute("position",new THREE.BufferAttribute(dustPositions,3));
 world.add(new THREE.Points(dustGeom,new THREE.PointsMaterial({color:0xd1bd9c,size:.07,transparent:true,opacity:.34,depthWrite:false})));
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
  const policeSign=label("ASHFORD COUNTY",2.7,.47,"#2c3033","#cfd4d4",58);policeSign.rotation.y=Math.PI/2;policeSign.position.set(.2,.75,1.075);car.add(policeSign);}
}
function makeTree(x,z){cyl(x,1.35,z,.25,2.7,mat(0x55483a));for(let i=0;i<3;i++)sphere(x+rand(-.6,.6),3.2+rand(-.3,.7),z+rand(-.5,.5),rand(.9,1.5),mat([0x47574d,0x59604b,0x3d4c45][i]));}
function plaidTexture(){
 const c=document.createElement("canvas");c.width=c.height=256;
 const ctx=c.getContext("2d");
 ctx.fillStyle="#535657";ctx.fillRect(0,0,256,256);
 // Slightly faded red-and-charcoal plaid; all fabric detail stays in one texture.
 for(let n=0;n<256;n+=64){
  ctx.fillStyle="#713f3d";ctx.fillRect(n,0,26,256);ctx.fillRect(0,n,256,26);
  ctx.fillStyle="rgba(30,36,42,.42)";
  ctx.fillRect(n+28,0,7,256);ctx.fillRect(0,n+28,256,7);
 }
 for(let n=0;n<256;n+=32){
  ctx.fillStyle="#29394188";ctx.fillRect(n,0,4,256);ctx.fillRect(0,n,256,4);
 }
 for(let i=0;i<3200;i++){
  const x=rand(0,256),y=rand(0,256);
  ctx.fillStyle=i%3===0?"rgba(208,184,150,.095)":"rgba(13,14,17,.095)";
  ctx.fillRect(x,y,rand(.3,1.8),rand(.3,1.7));
 }
 for(let i=0;i<32;i++){
  const x=rand(0,256),y=rand(0,256);
  ctx.strokeStyle="rgba(17,23,23,.15)";ctx.lineWidth=rand(.5,2.5);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand(-17,17),y+rand(-4,4));ctx.stroke();
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 return t;
}
const plaidMat=new THREE.MeshStandardMaterial({map:plaidTexture(),roughness:.98});
function humanoid(kind="player"){
 const group=new THREE.Group();
 const zombie=["walker","runner","brute","spitter"].includes(kind);
 const skin=mat(zombie?0x8c9783:kind==="mara"?0xc39e80:0xb8a18b);
 const fabric=kind==="player"?plaidMat:kind==="mara"?mat(0x84604c):kind==="vale"?mat(0xc5d1c9):kind==="runner"?mat(0x4e6665):kind==="brute"?mat(0x5e524c):kind==="spitter"?mat(0x62745b):mat(0x60635e);
 const pants=mat(zombie?0x48473f:kind==="vale"?0x4d616c:0x39444a);
 const torso=box(0,1.61,0,.85,1.0,.48,fabric,false,group);
 box(0,1.11,0,.72,.18,.43,pants,false,group);
 const head=sphere(0,2.42,-.01,.33,skin,group);
 const hair=box(0,2.68,.0,.54,.15,.5,mat(zombie?0x42483e:0x302d29),false,group);
 for(let side of [-1,1]){sphere(side*.13,2.46,-.29,.036,mat(0x1d2220),group);}
 const limbs=[];
 for(let s of [-1,1]){
  const arm=new THREE.Group();arm.position.set(s*.55,2.03,0);group.add(arm);
  const a=box(0,-.38,0,.29,.8,.31,fabric,false,arm);a.rotation.z=s*.10;
  sphere(0,-.80,-.01,.15,skin,arm);limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(s*.23,1.05,0);group.add(leg);
  box(0,-.40,0,.33,.87,.35,pants,false,leg);
  box(0,-.89,-.10,.37,.20,.55,dark,false,leg);limbs.push(leg);
 }
 if(kind==="player"){
  const canvas=mat(0x514d42),seam=mat(0x8a8576),worn=mat(0x3d4246),metal=mat(0x8d9494,.38,.6);
  box(0,1.56,.38,.73,.94,.28,canvas,false,group);
  for(let side of [-1,1]){
   const strap=box(side*.27,1.66,-.26,.10,.90,.09,seam,false,group);strap.rotation.z=side*.12;
   box(side*.26,1.78,-.335,.16,.12,.045,metal,false,group);
   box(side*.30,1.40,.53,.11,.28,.06,seam,false,group);
  }
  box(0,1.16,.55,.55,.32,.10,canvas,false,group);
  box(0,1.38,.544,.48,.08,.08,seam,false,group);
  box(.47,1.05,-.09,.14,.5,.13,metal,false,group);
  // Existing animation groups are preserved: elbow and knee wear follows their rig.
  for(const idx of [0,2])box(0,-.55,-.17,.30,.25,.06,worn,false,limbs[idx]);
  for(const idx of [1,3])box(0,-.58,-.19,.31,.25,.065,worn,false,limbs[idx]);
 }
 if(kind==="vale"){box(0,1.36,-.28,.52,.75,.07,mat(0xe1e4da),false,group);box(0,1.49,-.35,.09,.3,.07,mat(0x35727b),false,group);}
 if(kind==="mara"){box(0,1.65,-.29,.60,.74,.12,mat(0x473f37),false,group);}
 if(kind==="brute"){
  group.scale.set(1.32,1.27,1.24);torso.scale.x*=1.35;head.scale.x=1.12;
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
 if(zombie){box(0,1.57,-.29,.45,.22,.03,mat(0x482c2a),false,group);}
 group.userData={limbs,head,torso};
 return group;
}
function createNPC(kind,x,z,angle){const c=humanoid(kind);c.position.set(x,0,z);c.rotation.y=angle;world.add(c);return c;}
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
 const beamMat=new THREE.MeshBasicMaterial({color:0xf1ba73,transparent:true,opacity:.12,depthWrite:false});
 const beam=mesh(new THREE.CylinderGeometry(.65,.16,7,18,1,true),beamMat,0,3.6,0,marker);
 beam.material.side=THREE.DoubleSide;
 markerRing=mesh(new THREE.TorusGeometry(.8,.06,6,48),goldMat,0,.15,0,marker);markerRing.rotation.x=Math.PI/2;
 mesh(new THREE.OctahedronGeometry(.46,0),goldMat,0,5.7,0,marker);
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
function takeDamage(amount){if(state.qaNoDamage||state.hitTime>.05)return;state.health=clamp(state.health-amount,0,100);state.hitTime=.45;$("damage-flash").style.opacity=.75;tone(120,.22,"sawtooth",.09);setTimeout(()=>$("damage-flash").style.opacity=0,130);if(state.health<=0)gameOver();}
function confirmHit(killed=false){
 state.hitConfirm=killed?.38:.22;
 const marker=$("crosshair");marker.classList.remove("hit","kill");void marker.offsetWidth;
 marker.classList.add(killed?"kill":"hit");
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
function updateEnemies(dt){
 const p=pos();
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i];
  if(e.dead){
   e.death-=dt;e.mesh.rotation.z=Math.min(1.4,e.mesh.rotation.z+dt*2.3);
   e.mesh.position.y=-Math.max(0,1.7-e.death)*.20;
   if(e.death<=0){world.remove(e.mesh);enemies.splice(i,1);}
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
  const clear=!lineBlocked(e.x,e.z,p.x,p.z,.1);
  if(e.attackIntent){
   e.windup-=dt;
   if(e.windup<=0){
    const intent=e.attackIntent;e.attackIntent=null;e.cd=intent.cooldown;
    if(attackStillValid(intent,newDist,clear)){
     if(intent.kind==="spit")launchSpit(e,p);
     else takeDamage(intent.damage);
    }
   }
  }else if(e.cd<=0&&e.stagger<=0&&state.started&&!state.paused){
   const intent=chooseInfectedAction(e.type,newDist,clear);
   if(intent){e.attackIntent=intent;e.windup=intent.windup;}
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
 const speed=(sprint?7.15:4.25)*dt;
 const forward=V(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw)),right=V(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));
 const dx=(forward.x*mz+right.x*mx)*speed,dz=(forward.z*mz+right.z*mx)*speed;
 if(moving){
 if(!blocked(state.x+dx,state.z,.35))state.x+=dx;
 if(!blocked(state.x,state.z+dz,.35))state.z+=dz;
 state.angle=Math.atan2(-dx,-dz);
 }
 if(sprint)state.stamina=clamp(state.stamina-dt*18,0,100);else state.stamina=clamp(state.stamina+dt*13,0,100);
 state.thirst=clamp(state.thirst-dt*.026,0,100);state.hunger=clamp(state.hunger-dt*.012,0,100);
 if(state.thirst<3||state.hunger<3)state.health=clamp(state.health-dt*.8,0,100);
 playerVisual.position.set(state.x,Math.sin(state.time*(sprint?13:8))*(moving?.065:.016),state.z);
 playerVisual.rotation.y=state.angle;animateLimbs(playerVisual,moving?Math.sin(state.time*(sprint?13:8))*(sprint?1.1:.72):.02);
 poseSurvivor(moving,sprint);
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
 if(e.life<=0){world.remove(e.mesh);if(e.mesh.geometry)e.mesh.geometry.dispose();effects.splice(i,1);}
 }
}
function hud(){
 const pct=(id,v)=>$(id).style.width=clamp(v,0,100)+"%";
 pct("hp-bar",state.health);pct("st-bar",state.stamina);pct("th-bar",state.thirst);pct("hu-bar",state.hunger);
 $("hp-num").textContent=Math.ceil(state.health)+" / 100";$("st-num").textContent=Math.ceil(state.stamina)+" / 100";
 $("th-num").textContent=Math.ceil(state.thirst)+"%";$("hu-num").textContent=Math.ceil(state.hunger)+"%";
 $("weapon-name").textContent=state.hasGun?"PISTOL + CROWBAR":"CROWBAR";
 $("ammo").textContent=state.hasGun?state.ammo+" ROUNDS":"MELEE";
 const q=stages[state.stage];$("waypoint-distance").textContent=Math.round(dist(pos(),q.point))+" m";
 $("danger-text").textContent=state.stage===7?"INFECTED ASSAULT · "+state.waveKills+"/4":"AIRBORNE CONTAMINATION";
 if(q.kind==="interact"&&dist(pos(),q.point)<4){$("context").hidden=false;$("context-label").textContent="PRESS E · "+q.name;}else $("context").hidden=true;
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
function updateCamera(dt){
 const horizontal=Math.cos(cameraPitch)*12.5,vertical=Math.sin(cameraPitch)*12.5+state.cameraKick*.85;
 const pivot=V(state.x,1.65,state.z);
 const desired=V(state.x+Math.sin(cameraYaw)*horizontal,vertical+1.65,state.z+Math.cos(cameraYaw)*horizontal);
 const delta=desired.clone().sub(pivot),maxDist=delta.length(),dir=delta.normalize();
 cameraRay.set(pivot,dir);cameraRay.near=.2;cameraRay.far=maxDist;
 const hits=cameraRay.intersectObjects(solidMeshes,false);
 if(hits.length)desired.copy(pivot).addScaledVector(dir,Math.max(1.5,hits[0].distance-.35));
 camera.position.lerp(desired,1-Math.exp(-dt*8));camera.lookAt(pivot);
}
function togglePerf(){
 $("perf-panel").hidden=!$("perf-panel").hidden;
 if(!$("perf-panel").hidden)updatePerfReadout();
}
function updatePerfReadout(){
 if($("perf-panel").hidden)return;
 const frames=qaFrameMs.slice().sort((a,b)=>a-b),n=frames.length;
 const avg=n?frames.reduce((a,b)=>a+b,0)/n:0;
 const fps=avg?Math.round(1000/avg):0;
 const p95=n?Math.round(frames[Math.min(n-1,Math.floor(n*.95))]):0;
 $("perf-numbers").textContent="FPS (sample): "+fps+"\nFrame p95: "+p95+" ms\nDraw calls: "+renderer.info.render.calls+
 "\nTriangles: "+renderer.info.render.triangles+"\nPixel ratio: "+renderer.getPixelRatio().toFixed(2);
}
function applyQuality(mode,notify=false){
 qualityMode=mode==="performance"?"performance":"auto";
 const low=qualityMode==="performance";
 renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.6));
 renderer.shadowMap.enabled=!low;
 $("quality-button").textContent=low?"GRAPHICS: PERFORMANCE":"GRAPHICS: AUTO";
 try{localStorage.setItem("ashfordGraphicsV02",qualityMode);}catch(e){}
 if(notify)toast(low?"PERFORMANCE GRAPHICS ENABLED":"AUTO GRAPHICS ENABLED");
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
  if(state.stage===7){startWave();state.waveKills=clamp(JSON.parse(raw).waveKills||0,0,3);}
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
 if(matchMedia("(pointer:coarse)").matches||innerWidth<750)$("mobile-controls").hidden=false;
 loadGame();setMarker();try{tone(480,.15);}catch(e){}}
function controls(){
 $("start-button").onclick=start;$("pause-button").onclick=pause;$("inventory-button").onclick=showPack;$("perf-button").onclick=togglePerf;
 $("resume").onclick=resume;$("restart").onclick=hardReset;$("end-restart").onclick=hardReset;
 $("quality-button").onclick=()=>applyQuality(qualityMode==="auto"?"performance":"auto",true);
 try{qualityMode=localStorage.getItem("ashfordGraphicsV02")||"auto";}catch(e){}
 applyQuality(qualityMode);
 $("close-pack").onclick=()=>{closeAll();state.paused=false;};
 $("mobile-interact").onclick=interact;$("mobile-attack").onclick=melee;$("mobile-fire").onclick=shoot;
 for(const evt of ["pointerdown","pointerup","pointercancel"])$("mobile-sprint").addEventListener(evt,e=>{e.preventDefault();touch.sprint=evt==="pointerdown";});
 addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
 if(e.repeat)return;
 if(e.code==="Escape"){if($("pack-modal").classList.contains("visible")){resume();return;}if(activeDialog)return;pause();}
 if(e.code==="KeyI"){if($("pack-modal").classList.contains("visible"))resume();else showPack();}
 if(e.code==="KeyE")interact();if(e.code==="KeyF")shoot();if(e.code==="KeyP")togglePerf();if(e.code==="Space")melee();
 });
 addEventListener("keyup",e=>{keys[e.code]=false;});
 addEventListener("blur",()=>{for(const k in keys)keys[k]=false;touch.x=0;touch.y=0;touch.sprint=false;});
 const canvas=renderer.domElement;
 canvas.addEventListener("pointerdown",e=>{if(!state.started||state.paused||e.target!==canvas)return;lastPointer={x:e.clientX,y:e.clientY,dx:0,dy:0,id:e.pointerId,button:e.button};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener("pointermove",e=>{if(!lastPointer||lastPointer.id!==e.pointerId)return;const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;
 lastPointer.dx+=Math.abs(dx);lastPointer.dy+=Math.abs(dy);cameraYaw=clamp(cameraYaw-dx*.005,-Math.PI*40,Math.PI*40);cameraPitch=clamp(cameraPitch+dy*.003,.32,1.05);
 lastPointer.x=e.clientX;lastPointer.y=e.clientY;});
 canvas.addEventListener("pointerup",e=>{if(!lastPointer||lastPointer.id!==e.pointerId)return;if(lastPointer.dx+lastPointer.dy<10&&!matchMedia("(pointer:coarse)").matches){if(e.button===0)melee();if(e.button===2)shoot();}lastPointer=null;});
 canvas.addEventListener("contextmenu",e=>e.preventDefault());
 const joy=$("joystick"),stick=joy.querySelector(".stick");let joyId=null;
 joy.addEventListener("pointerdown",e=>{e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});
 joy.addEventListener("pointermove",e=>{if(e.pointerId===joyId)moveJoy(e);});
 function releaseJoy(e){if(e.pointerId!==joyId)return;joyId=null;touch.x=touch.y=0;stick.style.transform="translate(0,0)";}
 joy.addEventListener("pointerup",releaseJoy);joy.addEventListener("pointercancel",releaseJoy);
 function moveJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const x=e.clientX-cx,y=e.clientY-cy,len=Math.max(1,Math.hypot(x,y)),m=Math.min(len,46);touch.x=x/len*m/46;touch.y=y/len*m/46;stick.style.transform="translate("+touch.x*38+"px,"+touch.y*38+"px)";}
 addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(state.started&&(matchMedia("(pointer:coarse)").matches||innerWidth<750))$("mobile-controls").hidden=false;});
 addEventListener("beforeunload",()=>{if(state.started&&!state.ended)saveGame();});
}
// Test-only control surface: never exposed on GitHub Pages or public production.
function installLocalQA(){
 if(location.hostname!=="127.0.0.1"||new URLSearchParams(location.search).get("__qa")!=="1")return;
 Object.defineProperty(window,"__ashfordQA",{configurable:false,value:Object.freeze({
  snapshot(){return {stage:state.stage,health:state.health,ammo:state.ammo,hasGun:state.hasGun,supplies:state.supplies,waveKills:state.waveKills,ended:state.ended,x:state.x,z:state.z,enemies:enemies.filter(e=>!e.dead).map(e=>({type:e.type,x:e.x,z:e.z,hp:e.hp,max:e.max,ambush:e.ambush,intent:e.attackIntent?.kind||null,windup:e.windup}))};},
  perf(){const frames=[...qaFrameMs].sort((a,b)=>a-b);const n=frames.length,avg=n?frames.reduce((x,y)=>x+y,0)/n:0;
   return {sampleCount:n,averageFPS:avg?1000/avg:null,p50FrameMs:n?frames[Math.floor(n*.5)]:null,p95FrameMs:n?frames[Math.min(n-1,Math.floor(n*.95))]:null,
     drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio()};
  },
  noDamage(on){state.qaNoDamage=Boolean(on);},
  combatSetup(type="walker",range=6){
   if(!Object.hasOwn(INFECTED,type)||!Number.isFinite(range)||range<1||range>12)throw Error("Invalid combat fixture");
   for(const e of enemies)world.remove(e.mesh);enemies.length=0;
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
  finishWave(){if(state.stage!==7)throw new Error("Clinic assault is not active");
   for(const enemy of [...enemies].filter(e=>e.ambush&&!e.dead).slice(0,4)){hurtEnemy(enemy,enemy.hp+1);}
  }
 })});
}
const clock=new THREE.Clock();let fpsFrames=0,fpsLast=0;
const qaFrameMs=[];let perfPanelElapsed=0;
function animate(){
 requestAnimationFrame(animate);
 // Simulate up to 250 ms of wall-clock time using small steps so weak GPUs
 // don't slow player movement or tunnel through thin walls.
 const elapsed=Math.max(.001,clock.getDelta());
 const frameDt=Math.min(elapsed,.25);
 if(state.started&&!state.paused&&!state.ended){qaFrameMs.push(elapsed*1000);if(qaFrameMs.length>180)qaFrameMs.shift();}
 if(state.started&&!state.paused&&!state.ended){
  const count=Math.max(1,Math.ceil(frameDt/.045)),dt=frameDt/count;
  for(let step=0;step<count&&state.started&&!state.paused&&!state.ended;step++){
   state.time+=dt;state.lastSave+=dt;
   updatePlayer(dt);updateEnemies(dt);updateEffects(dt);
  }
  hud();
  if(state.lastSave>12){saveGame();state.lastSave=0;}
 }
 if(marker){markerRing.rotation.z+=frameDt*.8;marker.children[2].rotation.y+=frameDt*.75;marker.children[2].position.y=5.7+Math.sin(performance.now()*.002)*.18;}
 updateCamera(frameDt);drawMap();renderer.render(scene,camera);
 perfPanelElapsed+=elapsed;if(perfPanelElapsed>.9){updatePerfReadout();perfPanelElapsed=0;}
 // Measure actual elapsed frame time rather than capped physics delta.
 fpsFrames++;fpsLast+=elapsed;
 if(fpsLast>=5){
  const fps=fpsFrames/fpsLast;
  if(fps<27&&renderer.getPixelRatio()>1){applyQuality("performance");if(state.started)toast("FPS LOW — PERFORMANCE GRAPHICS ENABLED");}
  fpsLast=0;fpsFrames=0;
 }
}
try{
 makeWorld();playerVisual=humanoid("player");playerVisual.position.set(state.x,0,state.z);world.add(playerVisual);
 createNPC("mara",-14,-27,Math.PI);createNPC("vale",48,-29,Math.PI);
 spawnAmbient();makeMarker();setMarker();controls();installLocalQA();updateCamera(1);animate();
 $("loader").classList.add("hide");setTimeout(()=>$("loader").remove(),600);
}catch(err){$("loader").innerHTML='<h2>ASHFORD COULD NOT LOAD</h2><p style="max-width:420px;text-align:center;padding:12px">Check your WebGL support and internet connection. '+String(err.message).replace(/</g,"&lt;")+"</p>";console.error(err);}
