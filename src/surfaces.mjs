import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

export function createSurfaceLibrary(){
 const images=new Map(),sources=new WeakMap(),surfaces=[];
 let detailEnabled=false,colorsLoading;

 function imageFor(asset,map){
  const name=`${asset}-${map}.webp`;
  if(!images.has(name)){
   const image=new Image();
   image.src=new URL(`../assets/surfaces/${name}`,import.meta.url).href;
   images.set(name,image.decode().then(()=>image,()=>null));
  }
  return images.get(name);
 }

 function textureFor(surface,image,srgb){
  if(!sources.has(image)){
   const source=new THREE.Texture(image);
   source.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
   source.wrapS=source.wrapT=THREE.RepeatWrapping;
   sources.set(image,source);
  }
  // The UV transforms can differ without uploading another copy of the pixels.
  const map=sources.get(image).clone();
  map.repeat.set(surface.x,surface.y);
  map.needsUpdate=true;
  return map;
 }

 function applyDetail(surface){
  const {material,normal,rough}=surface;
  const nextNormal=detailEnabled?normal:null;
  const nextRough=detailEnabled?rough:null;
  if(material.normalMap===nextNormal&&material.roughnessMap===nextRough)return;
  // These maps are created on first use. Retain their sampler uploads while a
  // preset is off so cycling back to Quality does not upload the pixels again.
  material.normalMap=nextNormal;
  material.roughnessMap=nextRough;
  material.needsUpdate=true;
 }

 function loadDetail(surface){
  if(surface.detail)return surface.detail;
  surface.detail=Promise.all([imageFor(surface.asset,"normal"),imageFor(surface.asset,"rough")]).then(([normal,rough])=>{
   if(normal)surface.normal=textureFor(surface,normal,false);
   if(rough)surface.rough=textureFor(surface,rough,false);
   applyDetail(surface);
  });
  return surface.detail;
 }

 return {
  register(asset,material,x,y,tint,strength=.55){
   material.userData.photoSurface=true;
   material.normalScale.setScalar(strength);
   surfaces.push({asset,material,x,y,tint,normal:null,rough:null});
   return material;
  },
  loadColors(){
   return colorsLoading??=Promise.all(surfaces.map(async surface=>{
    const image=await imageFor(surface.asset,"color");
    if(!image)return;
    const {material}=surface;
    material.map?.dispose();
    material.map=surface.color=textureFor(surface,image,true);
    material.color.setHex(surface.tint);
    material.needsUpdate=true;
   }));
  },
  setDetail(enabled){
   detailEnabled=enabled;
   for(const surface of surfaces){
    applyDetail(surface);
    if(enabled)void loadDetail(surface);
   }
  },
  status(){
   return {
    colors:new Set(surfaces.filter(s=>s.color).map(s=>s.asset)).size,
    detail:new Set(surfaces.filter(s=>s.material.normalMap&&s.material.roughnessMap).map(s=>s.asset)).size
   };
  }
 };
}
