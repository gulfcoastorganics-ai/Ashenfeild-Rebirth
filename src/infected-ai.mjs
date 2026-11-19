const profiles={
 walker:{sight:19,hearing:1,memory:2.4,pace:.56},
 runner:{sight:25,hearing:1.12,memory:2.9,pace:.69},
 brute:{sight:18,hearing:.82,memory:3.4,pace:.51},
 spitter:{sight:23,hearing:.9,memory:2.7,pace:.56}
};

export function createBrain(type,x,z,offset=0){
 return {profile:profiles[type]??profiles.walker,mode:"idle",x,z,homeX:x,homeZ:z,seen:-Infinity,
  investigateUntil:0,suspiciousUntil:0,heard:0,visionAt:offset,visible:false};
}

export function sense(brain,{now,player,actor,distance,facing,alarm,heard,sight}){
 const {profile}=brain;
 if(now>=brain.visionAt){
  brain.visionAt=now+.19;
  brain.visible=distance<profile.sight&&(facing>-.28||distance<5||brain.mode==="pursue")&&sight();
 }
 if(brain.visible||alarm){
  brain.mode="pursue";brain.x=player.x;brain.z=player.z;brain.seen=now;return;
 }
 if(heard&&heard.id>brain.heard){
  brain.heard=heard.id;
  brain.x=heard.x;brain.z=heard.z;brain.suspiciousUntil=now+.32;brain.investigateUntil=now+4.6;
  brain.mode="suspicious";return;
 }
 if(now-brain.seen<profile.memory){brain.mode="search";return;}
 if(now<brain.suspiciousUntil){brain.mode="suspicious";return;}
 if(now<brain.investigateUntil){brain.mode="investigate";return;}
 const patrol=Math.floor(now/5)%2;
 const away=Math.hypot(brain.homeX-actor.x,brain.homeZ-actor.z)>4.25;
 brain.mode=away?"disengage":patrol?"patrol":"idle";
 brain.x=brain.homeX+(patrol&&!away?3.7:0);brain.z=brain.homeZ+(patrol&&!away?1.5:0);
}

export function separation(enemy,group){
 let x=0,z=0;
 for(const other of group){
  if(other===enemy||other.dead)continue;
  const dx=enemy.x-other.x,dz=enemy.z-other.z,d=dx*dx+dz*dz;
  if(d>=1.65**2)continue;
  if(d<1e-6){x+=(enemy.order<other.order?-1:1)*.8;continue;}
  const length=Math.sqrt(d),weight=(1-length/1.65)*.9/length;
  x+=dx*weight;z+=dz*weight;
 }
 const length=Math.max(.8,Math.hypot(x,z))/.8;
 return {x:x/length,z:z/length};
}
