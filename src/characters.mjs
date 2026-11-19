import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
import {GLTFLoader} from "./vendor/loaders/GLTFLoader.js";
import {clone} from "./vendor/utils/SkeletonUtils.js";

export const requiredClips=Object.freeze([
 "idle","walk","shamble","run","turnLeft","turnRight","melee","aim","fire","dodge","hit","fall","fallBack","interact","talk","stagger","attack"
]);
const essentialBones=["Hips","Spine2","Head","RightHand","WeaponR","LeftFoot","RightFoot"];
const infectedStyles={
 walker:{size:[1,1,1],shirt:0xc5be9e,skin:0xc4ba95},
 runner:{size:[.88,1.02,.88],shirt:0x83a49b,skin:0xc3c593},
 brute:{size:[1.38,1.26,1.33],shirt:0xaa8070,skin:0xc3a283},
 spitter:{size:[1.06,1.02,1.17],shirt:0xa6b475,skin:0xb5c386}
};

function loadAvatar(loader,id){
 return loader.loadAsync(new URL(`../assets/characters/${id}.glb`,import.meta.url).href).then(({scene,animations})=>{
  const rest=new Map();let meshes=0;
  scene.traverse(node=>{
   if(node.isBone)rest.set(node.name,node);
   if(node.isSkinnedMesh&&node.skeleton.bones.length===26)meshes++;
  });
  if(!meshes||essentialBones.some(name=>!rest.has(name)))throw new Error(`Invalid avatar skeleton for ${id}`);
  if(id==="survivor"&&requiredClips.some(name=>!animations.some(clip=>clip.name===name)))throw new Error("Incomplete animation library");
  scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(scene,true);
  const height=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(height)||height<1.3||height>2.3)throw new Error(`Invalid avatar height for ${id}`);
  return {scene,animations,rest,height,foot:bounds.min.y};
 });
}

function retarget(motion,target){
 const transformed=new THREE.Quaternion();
 const sourceInverse=new THREE.Quaternion();
 const hipRatio=target.rest.get("Hips").position.y/motion.rest.get("Hips").position.y;
 return motion.animations.map(clip=>{
  const tracks=[];
  for(const original of clip.tracks){
   const [joint,property]=original.name.split(".");
   const source=motion.rest.get(joint),destination=target.rest.get(joint);
   if(!source||!destination)continue;
   if(property==="quaternion"){
    const track=original.clone();
    sourceInverse.copy(source.quaternion).invert();
    for(let i=0;i<track.values.length;i+=4){
     transformed.fromArray(track.values,i).premultiply(sourceInverse).premultiply(destination.quaternion).normalize();
     transformed.toArray(track.values,i);
    }
    tracks.push(track);
   }else if(joint==="Hips"&&property==="position"){
    const track=original.clone();
    for(let i=0;i<track.values.length;i+=3){
     track.values[i]=destination.position.x;
     track.values[i+1]=destination.position.y+(track.values[i+1]-source.position.y)*hipRatio;
     track.values[i+2]=destination.position.z;
    }
    tracks.push(track);
   }
  }
  return new THREE.AnimationClip(clip.name,clip.duration,tracks);
 });
}

export function createCharacterLibrary(){
 const loader=new GLTFLoader(),files=new Map(),rigClips=new Map(),variants=new Map();
 const installed=new Set();
 function load(id){
  if(!files.has(id))files.set(id,loadAvatar(loader,id).catch(()=>null));
  return files.get(id);
 }
 function materialsFor(kind,mesh){
  const style=infectedStyles[kind];
  if(!style)return mesh.material;
  if(!variants.has(kind))variants.set(kind,new Map());
  const materials=variants.get(kind);
  const tint=original=>{
   if(!materials.has(original)){
    const copy=original.clone();
    if(original.name==="Skin")copy.color.multiply(new THREE.Color(style.skin));
    if(original.name.startsWith("Tattered"))copy.color.multiply(new THREE.Color(style.shirt));
    if(original.name==="Eyes")copy.color.set(0xa5a187);
    materials.set(original,copy);
   }
   return materials.get(original);
  };
  return Array.isArray(mesh.material)?mesh.material.map(tint):tint(mesh.material);
 }
 return {
  preload(){return load("survivor");},
  async attach(actor,kind){
   const id=kind==="player"?"survivor":infectedStyles[kind]?"infected":kind;
   const [motion,asset]=await Promise.all([load("survivor"),load(id)]);
   if(!motion||!asset||!actor.parent)return null;
   if(!rigClips.has(id))rigClips.set(id,retarget(motion,asset));
   const model=clone(asset.scene),style=infectedStyles[kind];
   const size=style?.size??[1,1,1];
   const targetHeight=({player:2.65,mara:2.51,vale:2.44,guard:2.73})[kind]??2.63;
   const scale=targetHeight/asset.height;
   model.scale.multiply(new THREE.Vector3(size[0]*scale,size[1]*scale,size[2]*scale));
   model.position.y=-asset.foot*scale*size[1];
   model.rotation.y=Math.PI;
   let skeleton;
   model.traverse(node=>{
    if(!node.isSkinnedMesh)return;
    // One glTF skin backs all of this avatar's material primitives. The clone
    // helper splits it across the meshes, which would upload a bone texture per draw.
    if(skeleton)node.bind(skeleton,node.bindMatrix);
    else skeleton=node.skeleton;
    node.castShadow=true;node.receiveShadow=true;
    node.material=materialsFor(kind,node);
    node.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,asset.height*.48,0),asset.height*1.10);
   });
   const mixer=new THREE.AnimationMixer(model),clips=new Map(rigClips.get(id).map(clip=>[clip.name,clip]));
   let current,pose;
   const handle={
    kind,model,height:targetHeight*size[1],equipment:null,
    step(command,dt){
     const clip=clips.get(command.name)??clips.get("idle");
     const timed=Number.isFinite(command.phase);
     if(pose!==command.name){
      const next=mixer.clipAction(clip);
      const previous=current;
      next.reset().setEffectiveWeight(1).setLoop(timed?THREE.LoopOnce:THREE.LoopRepeat,timed?1:Infinity).play();
      next.clampWhenFinished=timed;
      if(previous&&previous!==next){previous.fadeOut(.13);next.fadeIn(.13);}
      current=next;pose=command.name;
     }
     current.paused=timed;
     if(timed)current.time=Math.min(.9999,Math.max(0,command.phase))*clip.duration;
     else current.setEffectiveTimeScale(command.rate??1);
     mixer.update(dt);
    },
    state(){return {pose,time:current?.time??0};},
    dispose(){
     mixer.stopAllAction();mixer.uncacheRoot(model);
     skeleton.dispose();
     actor.remove(model);installed.delete(handle);
    }
   };
   installed.add(handle);
   actor.add(model);
   handle.step({name:"idle",rate:1},0);
   model.visible=false;
   return handle;
  },
  status(){return [...installed].map(r=>({kind:r.kind,height:r.height,...r.state(),shown:r.model.visible}));}
 };
}
