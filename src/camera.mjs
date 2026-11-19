const axes=["x","y","z"];
// Length fraction along a camera arm, with clearance for its near plane.
export function cameraClearance(origin,destination,boxes,radius=.27){
 let closest=1;
 const lowX=Math.min(origin.x,destination.x)-radius,highX=Math.max(origin.x,destination.x)+radius;
 const lowY=Math.min(origin.y,destination.y)-radius,highY=Math.max(origin.y,destination.y)+radius;
 const lowZ=Math.min(origin.z,destination.z)-radius,highZ=Math.max(origin.z,destination.z)+radius;
 for(const {min,max} of boxes){
  if(lowX>max.x||highX<min.x||lowY>max.y||highY<min.y||lowZ>max.z||highZ<min.z)continue;
  let enter=0,leave=closest,inside=true;
  for(const axis of axes){
   const start=origin[axis],delta=destination[axis]-start,lo=min[axis]-radius,hi=max[axis]+radius;
   if(start<lo||start>hi)inside=false;
   if(Math.abs(delta)<1e-6){if(start<lo||start>hi){leave=-1;break;}continue;}
   const a=(lo-start)/delta,b=(hi-start)/delta;
   enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
   if(enter>leave)break;
  }
  // The pivot may graze expanded bounds near a jamb. Keep outward motion possible.
  if(!inside&&enter<=leave)closest=enter;
 }
 return closest;
}

export function cameraArm(previous,target,dt){
 return target<=previous?target:previous+(target-previous)*(1-Math.exp(-dt*6));
}

export function damageSide(cameraYaw,dx,dz){
 const side=Math.cos(cameraYaw)*dx-Math.sin(cameraYaw)*dz;
 const ahead=-Math.sin(cameraYaw)*dx-Math.cos(cameraYaw)*dz;
 return Math.abs(side)>Math.abs(ahead)?(side>0?"right":"left"):(ahead>0?"front":"rear");
}
