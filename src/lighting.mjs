import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

export async function loadMaterials(){
 const image=new Image();
 image.src=new URL("../assets/ashford-materials.webp",import.meta.url).href;
 let timer;
 try{
  await Promise.race([image.decode(),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error("Material sheet timed out")),3200);
  })]);
 }catch{return null;}finally{clearTimeout(timer);}
 return ({column,row,repeatX=1,repeatY=1})=>{
  const tile=document.createElement("canvas");
  tile.width=tile.height=384;
  const ctx=tile.getContext("2d");
  const size=image.naturalWidth/2;
  ctx.drawImage(image,column*size+2,row*size+2,size-4,size-4,0,0,384,384);
  const texture=new THREE.CanvasTexture(tile);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(repeatX,repeatY);
  return texture;
 };
}

export function createSky(){
 const width=256,height=128;
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d");
 const sky=ctx.createLinearGradient(0,0,0,height);
 sky.addColorStop(0,"#293940");
 sky.addColorStop(.28,"#4c6266");
 sky.addColorStop(.51,"#a79d83");
 sky.addColorStop(.61,"#766f60");
 sky.addColorStop(.74,"#4c504d");
 sky.addColorStop(1,"#3e4443");
 ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
 const glow=ctx.createRadialGradient(117,53,2,117,53,50);
 glow.addColorStop(0,"rgba(255,224,167,.96)");
 glow.addColorStop(.16,"rgba(241,211,158,.63)");
 glow.addColorStop(1,"rgba(241,211,158,0)");
 ctx.fillStyle=glow;ctx.fillRect(0,0,width,height*.68);
 for(let layer=0;layer<11;layer++){
  const y=24+layer*3.6;
  ctx.fillStyle=layer%2?"rgba(62,71,70,.15)":"rgba(168,166,145,.14)";
  ctx.beginPath();ctx.moveTo(0,y);
  ctx.bezierCurveTo(68,y+Math.sin(layer)*8,172,y-Math.cos(layer)*8,width,y);
  ctx.lineTo(width,y+2.5);
  ctx.bezierCurveTo(190,y+3.5,67,y+6,0,y+2.5);
  ctx.closePath();ctx.fill();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.mapping=THREE.EquirectangularReflectionMapping;
 return texture;
}

export function lightPool(){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
 const ctx=canvas.getContext("2d");
 const matte=ctx.createRadialGradient(64,64,6,64,64,62);
 matte.addColorStop(0,"rgba(255,221,165,.88)");
 matte.addColorStop(.48,"rgba(237,196,136,.39)");
 matte.addColorStop(1,"rgba(237,196,136,0)");
 ctx.fillStyle=matte;ctx.fillRect(0,0,128,128);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshBasicMaterial({map,transparent:true,opacity:.50,depthWrite:false,blending:THREE.AdditiveBlending});
}
