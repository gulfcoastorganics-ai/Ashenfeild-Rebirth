import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

function seeded(seed){
 return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}
function paintedTexture(w,h,draw){
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
 draw(canvas.getContext("2d"));
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 return texture;
}
export function floorboards(width,depth){
 const texture=paintedTexture(512,512,ctx=>{
  const random=seeded(16421),colors=["#6b5140","#584435","#705744","#624937","#765f4c"];
  for(let row=0;row<8;row++){
   const y=row*64,offset=32+row*89%223;
   ctx.fillStyle=colors[row%colors.length];ctx.fillRect(0,y,512,64);
   ctx.fillStyle=colors[(row+2)%colors.length];ctx.fillRect(offset,y,256,64);
   const shade=ctx.createLinearGradient(0,y,0,y+64);
   shade.addColorStop(0,"rgba(21,16,13,.66)");shade.addColorStop(.14,"rgba(166,131,97,.14)");
   shade.addColorStop(.8,"rgba(21,16,13,0)");shade.addColorStop(1,"rgba(21,16,13,.58)");
   ctx.fillStyle=shade;ctx.fillRect(0,y,512,64);
   ctx.fillStyle="#36302a";ctx.fillRect(offset,y,2,64);ctx.fillRect((offset+256)%512,y,2,64);
   for(let i=0;i<110;i++){
    ctx.strokeStyle=i%4?"rgba(37,26,19,.16)":"rgba(202,166,127,.19)";
    const x=random()*512,py=y+random()*61,length=18+random()*139;
    ctx.beginPath();ctx.moveTo(x,py);ctx.quadraticCurveTo(x+length/2,py+(random()-.5)*4,x+length,py);ctx.stroke();
   }
  }
 });
 texture.repeat.set(width/8,depth/4.4);
 return texture;
}
export function masonry(base,seed,repeatX,repeatY,brick=false){
 const texture=paintedTexture(512,256,ctx=>{
  const random=seeded(seed);
  ctx.fillStyle=base;ctx.fillRect(0,0,512,256);
  if(brick){
   for(let row=0;row<8;row++){
    ctx.fillStyle="rgba(30,29,27,.5)";ctx.fillRect(0,row*32,512,3);
    for(let x=(row%2)*43-86;x<512;x+=86){
     ctx.fillStyle="rgba(27,24,21,.49)";ctx.fillRect(x,row*32,3,32);
     ctx.fillStyle=random()>.45?"rgba(160,119,95,.11)":"rgba(25,24,22,.13)";
     ctx.fillRect(x+3,row*32+3,83,29);
    }
   }
  }
  for(let i=0;i<5500;i++){
   ctx.fillStyle=i%4?"rgba(23,21,19,.11)":"rgba(211,194,168,.12)";
   const x=random()*512,y=random()*256;ctx.fillRect(x,y,.45+random()*4,.45+random()*3);
  }
  for(let i=0;i<38;i++){
   const x=random()*512,y=random()*256,r=4+random()*24;
   const blot=ctx.createRadialGradient(x,y,0,x,y,r);
   blot.addColorStop(0,i%3?"rgba(35,31,24,.26)":"rgba(202,192,161,.12)");blot.addColorStop(1,"rgba(35,31,24,0)");
   ctx.fillStyle=blot;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
 });
 texture.repeat.set(repeatX,repeatY);
 return new THREE.MeshStandardMaterial({map:texture,roughness:.95});
}
export function sidewalkTexture(){
 const texture=paintedTexture(512,256,ctx=>{
  const random=seeded(38247);
  ctx.fillStyle="#666660";ctx.fillRect(0,0,512,256);
  for(let i=0;i<5;i++){
   const x=i*102;
   ctx.fillStyle=i%2?"#6f6d64":"#5f625d";ctx.fillRect(x,0,102,256);
   ctx.fillStyle="#404440";ctx.fillRect(x,0,2,256);ctx.fillRect(x,127,102,2);
   ctx.fillStyle="#78776e";ctx.fillRect(x+2,0,1,256);ctx.fillRect(x+2,129,100,1);
  }
  for(let i=0;i<3800;i++){
   ctx.fillStyle=i%3?"rgba(24,26,22,.13)":"rgba(181,175,158,.14)";
   ctx.fillRect(random()*512,random()*256,1+random()*3,1+random()*3);
  }
 });
 texture.repeat.set(10,1);
 return texture;
}
export function faceGeometry(detail){
 const geometry=new THREE.SphereGeometry(1,detail?24:16,detail?18:12);
 const points=geometry.getAttribute("position"),colors=[];
 const bump=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
 for(let i=0;i<points.count;i++){
  const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
  const front=Math.max(0,-z)**1.6,absX=Math.abs(x);
  const socket=bump(absX,y,.38,.13,.22,.19);
  const cheek=bump(absX,y,.55,-.13,.25,.25);
  const nose=bump(absX,y,0,-.045,.174,.31);
  const lip=bump(absX,y,0,-.36,.44,.135);
  const chin=bump(absX,y,0,-.7,.62,.185);
  const jaw=1-.13*bump(absX,y,.68,-.78,.42,.29);
  points.setXYZ(i,x*jaw,y,z-front*(nose*.28+cheek*.09+lip*.085+chin*.2-socket*.15));
  const grain=Math.sin(i*19.7)*.022;
  const tone=1+grain-front*(socket*.20+lip*.04+chin*.08);
  colors.push(tone+cheek*.055,tone-cheek*.025,tone-cheek*.031);
 }
 geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 return geometry;
}
export function carBody(sections){
 const vertices=[],indices=[];
 for(const [x,bottom,top,halfWidth] of sections){
  for(const [y,z] of [[bottom,-halfWidth*.88],[bottom,halfWidth*.88],[top,halfWidth],[top,-halfWidth]])vertices.push(x,y,z);
 }
 for(let i=0;i<sections.length-1;i++)for(let side=0;side<4;side++){
  const a=i*4+side,b=i*4+(side+1)%4,c=b+4,d=a+4;
  indices.push(a,d,b,b,d,c);
 }
 indices.push(0,1,2,0,2,3);
 const end=(sections.length-1)*4;
 indices.push(end,end+2,end+1,end,end+3,end+2);
 const result=new THREE.BufferGeometry();
 result.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));result.setIndex(indices);
 const flat=result.toNonIndexed();flat.computeVertexNormals();
 return flat;
}
