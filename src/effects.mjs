import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

export const effectLimits=Object.freeze({particles:56,tracers:4,flashes:3,swings:3,lights:0,decals:0});

export function createEffectPool(world){
 const root=new THREE.Group();world.add(root);
 const lineGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,1)]);
 const flashGeometry=new THREE.SphereGeometry(1,8,5);
 const arcGeometry=new THREE.TorusGeometry(1.03,.037,4,21,Math.PI*.68);
 const makePool=(limit,geometry,color,line=false)=>Array.from({length:limit},()=>{
  const Material=line?THREE.LineBasicMaterial:THREE.MeshBasicMaterial;
  const Shape=line?THREE.Line:THREE.Mesh;
  const item=new Shape(geometry,new Material({color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  item.visible=false;root.add(item);
  return {item,time:0,total:1,opacity:1};
 });
 const tracers=makePool(effectLimits.tracers,lineGeometry,0xffd59a,true);
 const flashes=makePool(effectLimits.flashes,flashGeometry,0xffb05b);
 const swings=makePool(effectLimits.swings,arcGeometry,0xdba875);
 const groups=[tracers,flashes,swings];
 const particles=Array.from({length:effectLimits.particles},()=>({time:0}));
 let head=0,seed=62197;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const positions=new Float32Array(effectLimits.particles*3),colors=new Float32Array(positions.length);
 const cloudGeometry=new THREE.BufferGeometry();
 cloudGeometry.setAttribute("position",new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 cloudGeometry.setAttribute("color",new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
 const cloud=new THREE.Points(cloudGeometry,new THREE.PointsMaterial({size:.095,vertexColors:true,transparent:true,opacity:.78,depthWrite:false}));
 cloud.frustumCulled=false;cloud.visible=false;root.add(cloud);
 const direction=new THREE.Vector3(),north=new THREE.Vector3(0,0,1);
 const palette={flesh:new THREE.Color(0x9a5f4e),stone:new THREE.Color(0xd4c7aa),metal:new THREE.Color(0xffca77),pickup:new THREE.Color(0xf2d091)};
 function use(pool,life,opacity){
  const slot=pool.find(value=>value.time<=0)??pool.reduce((a,b)=>a.time<b.time?a:b);
  slot.time=slot.total=life;slot.fresh=true;slot.opacity=opacity;slot.item.material.opacity=opacity;slot.item.visible=true;
  return slot.item;
 }
 return {
  strike(x,y,z,yaw,tier){
   const ring=use(swings,.12,tier==="performance"?.17:.30);
   ring.position.set(x,y,z);ring.rotation.set(.65,-yaw,.14);
  },
  shot(start,end,tier){
   const tracer=use(tracers,.075,tier==="performance"?.46:.72);
   direction.subVectors(end,start);
   tracer.position.copy(start);tracer.scale.z=direction.length();
   if(tracer.scale.z>0)tracer.quaternion.setFromUnitVectors(north,direction.normalize());
   const flash=use(flashes,.065,.9);flash.position.copy(start);flash.scale.setScalar(tier==="performance"?.15:.24);
  },
  impact(x,y,z,dx,dz,kind,tier,motion=true){
   const color=palette[kind]??palette.stone;
   const count=!motion?3:tier==="performance"?5:tier==="balanced"?10:14;
   for(let i=0;i<count;i++){
    const part=particles[head++%particles.length];
    part.x=x;part.y=y;part.z=z;part.vx=(noise()-.5)*3.8+dx*2.7;part.vy=1.4+noise()*2.4;
    part.vz=(noise()-.5)*3.8+dz*2.7;part.time=part.total=.20+noise()*.27;part.color=color;part.fresh=true;
   }
  },
  step(dt){
   for(const pool of groups)for(const s of pool){
    if(s.time<=0)continue;
    if(s.fresh){s.fresh=false;continue;}
    s.time=Math.max(0,s.time-dt);s.item.visible=s.time>0;
    s.item.material.opacity=s.opacity*(s.time/s.total);
   }
   let live=0;
   for(const p of particles){
    if(p.time<=0)continue;
    const elapsed=p.fresh?0:dt;p.fresh=false;
    p.time-=elapsed;if(p.time<=0)continue;
    p.x+=p.vx*elapsed;p.y+=p.vy*elapsed;p.z+=p.vz*elapsed;p.vy-=8*elapsed;
    const at=live++*3,strength=Math.min(1,p.time/p.total*1.6);
    positions[at]=p.x;positions[at+1]=p.y;positions[at+2]=p.z;
    colors[at]=p.color.r*strength;colors[at+1]=p.color.g*strength;colors[at+2]=p.color.b*strength;
   }
   cloud.visible=live>0;cloudGeometry.setDrawRange(0,live);
   if(live){cloudGeometry.attributes.position.needsUpdate=true;cloudGeometry.attributes.color.needsUpdate=true;}
  },
  status(){return {particles:particles.filter(p=>p.time>0).length,tracers:tracers.filter(p=>p.time>0).length,
   flashes:flashes.filter(p=>p.time>0).length,swings:swings.filter(p=>p.time>0).length};}
 };
}
