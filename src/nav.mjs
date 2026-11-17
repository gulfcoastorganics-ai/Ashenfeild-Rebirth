/**
 * Pure 2D collision/navigation helpers for Ashford Rebirth.
 * Zero dependencies, deterministic, and testable in Node.
 */
export const WORLD_LIMITS=Object.freeze({minX:-74,maxX:74,minZ:-55,maxZ:44});
export const ENTRANCES=Object.freeze([
 {left:-61.5,right:-36.5,back:-37.5,front:-14.5,door:-47},
 {left:-24,right:2,back:-38,front:-14,door:-11},
 {left:29.5,right:60.5,back:-39,front:-13,door:44}
]);
export function isBlocked(x,z,r=.3,obstacles=[],bounds=WORLD_LIMITS){
 if(x<bounds.minX+r||x>bounds.maxX-r||z<bounds.minZ+r||z>bounds.maxZ-r)return true;
 for(const o of obstacles){
  if(x+r>o.x-o.w/2&&x-r<o.x+o.w/2&&z+r>o.z-o.d/2&&z-r<o.z+o.d/2)return true;
 }
 return false;
}
export function lineBlocked(x1,z1,x2,z2,r=.1,obstacles=[],bounds=WORLD_LIMITS){
 const length=Math.hypot(x2-x1,z2-z1);
 const steps=Math.max(1,Math.ceil(length/.35));
 // Allow close-quarters hit detection, but reject any wall crossed by the centerline.
 for(let i=1;i<steps;i++){
  const t=i/steps;
  if(isBlocked(x1+(x2-x1)*t,z1+(z2-z1)*t,r,obstacles,bounds))return true;
 }
 return false;
}
export function chaseGoal(enemy,target,entrances=ENTRANCES){
 for(const entry of entrances){
  const playerInside=target.x>entry.left+1&&target.x<entry.right-1&&target.z<entry.front-1&&target.z>entry.back+.8;
  const enemyOutside=enemy.z>entry.front-.5||enemy.x<entry.left+.5||enemy.x>entry.right-.5;
  if(playerInside&&enemyOutside){
   if(enemy.z>entry.front+3.5||Math.abs(enemy.x-entry.door)>2.3)
    return {x:entry.door,z:entry.front+2.3};
   return {x:entry.door,z:entry.front-3.2};
  }
 }
 return target;
}
export function clampFinite(value,min,max,fallback){
 return typeof value==="number"&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
}
export function restoreCheckpoint(saved,current){
 if(!saved||typeof saved!=="object")return {...current};
 const s={...current};
 s.stage=Math.round(clampFinite(saved.stage,0,8,current.stage));
 s.x=clampFinite(saved.x,WORLD_LIMITS.minX+1,WORLD_LIMITS.maxX-1,current.x);
 s.z=clampFinite(saved.z,WORLD_LIMITS.minZ+1,WORLD_LIMITS.maxZ-1,current.z);
 for(const name of ["health","stamina","thirst","hunger"])s[name]=clampFinite(saved[name],0,100,current[name]);
 s.ammo=Math.round(clampFinite(saved.ammo,0,999,current.ammo));
 s.kills=Math.round(clampFinite(saved.kills,0,9999,current.kills));
 s.waveKills=Math.round(clampFinite(saved.waveKills,0,3,current.waveKills));
 s.hasGun=Boolean(saved.hasGun);
 s.supplies=Math.round(clampFinite(saved.supplies,0,1,current.supplies));
 const inv=saved.inventory&&typeof saved.inventory==="object"?saved.inventory:{};
 s.inventory={...current.inventory};
 for(const name of ["water","food","bandage"])s.inventory[name]=Math.round(clampFinite(inv[name],0,99,current.inventory[name]));
 // A saved location inside a building wall is never a safe spawn.
 if(isBlocked(s.x,s.z,.35,[])) {s.x=current.x;s.z=current.z;}
 return s;
}

/** Clearance-aware bounded 8-direction A*. Smoothed world waypoints; [] if unreachable. */
export function findPath(start,goal,obstacles=[],options={}){
 const step=options.step??1.75,r=options.clearance??.45,limit=options.maxVisited??4500,b=options.bounds??WORLD_LIMITS;
 if(![start.x,start.z,goal.x,goal.z,step].every(Number.isFinite)||step<=.4)return [];
 if(!isBlocked(start.x,start.z,r,obstacles,b)&&!isBlocked(goal.x,goal.z,r,obstacles,b)&&!lineBlocked(start.x,start.z,goal.x,goal.z,r,obstacles,b))return [{x:goal.x,z:goal.z}];
 const cols=Math.floor((b.maxX-b.minX)/step),rows=Math.floor((b.maxZ-b.minZ)/step),size=cols*rows;
 if(size>20000||cols<2||rows<2)return [];
 const index=(x,z)=>z*cols+x,point=i=>({x:b.minX+(i%cols+.5)*step,z:b.minZ+(Math.floor(i/cols)+.5)*step});
 const blockedCache=new Uint8Array(size);
 function open(x,z){
   if(x<0||z<0||x>=cols||z>=rows)return false;
   const id=index(x,z);
   if(!blockedCache[id]){const p=point(id);blockedCache[id]=isBlocked(p.x,p.z,r,obstacles,b)?2:1;}
   return blockedCache[id]===1;
 }
 function nearest(p){
   const sx=Math.max(0,Math.min(cols-1,Math.floor((p.x-b.minX)/step)));
   const sz=Math.max(0,Math.min(rows-1,Math.floor((p.z-b.minZ)/step)));
   for(let k=0;k<=5;k++){
     let best=-1,score=Infinity;
     for(let z=sz-k;z<=sz+k;z++)for(let x=sx-k;x<=sx+k;x++){
       if(Math.max(Math.abs(x-sx),Math.abs(z-sz))!==k||!open(x,z))continue;
       const q=point(index(x,z)),d=(q.x-p.x)**2+(q.z-p.z)**2;
       if(d<score){best=index(x,z);score=d;}
     }
     if(best>=0)return best;
   }
   return -1;
 }
 const src=nearest(start),dst=nearest(goal);if(src<0||dst<0)return [];
 const g=new Float64Array(size);g.fill(Infinity);
 const prev=new Int32Array(size);prev.fill(-1);const visited=new Uint8Array(size);
 const heap=[],h=id=>Math.hypot(id%cols-dst%cols,Math.floor(id/cols)-Math.floor(dst/cols));
 const push=(id,f)=>{
   const obj={id,f};let i=heap.length;heap.push(obj);
   while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]=obj;
 };
 const pop=()=>{
   const result=heap[0],last=heap.pop();
   if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;
     if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;
     if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;
   }heap[i]=last;}return result;
 };
 const offsets=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[-1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,-1,Math.SQRT2]];
 g[src]=0;push(src,h(src));let count=0,found=false;
 while(heap.length&&count++<limit){
   const id=pop().id;if(visited[id])continue;visited[id]=1;if(id===dst){found=true;break;}
   const x=id%cols,z=Math.floor(id/cols);
   for(const [dx,dz,cost] of offsets){
     const nx=x+dx,nz=z+dz;if(!open(nx,nz))continue;
     if(dx&&dz&&(!open(x+dx,z)||!open(x,z+dz)))continue;
     const nid=index(nx,nz),from=point(id),to=point(nid);
     if(lineBlocked(from.x,from.z,to.x,to.z,r,obstacles,b))continue;
     const next=g[id]+cost;if(visited[nid]||next>=g[nid]-1e-6)continue;
     g[nid]=next;prev[nid]=id;push(nid,next+h(nid));
   }
 }
 if(!found)return [];
 const raw=[];
 for(let i=dst;i!==src;i=prev[i]){if(i<0||raw.length>size)return [];raw.push(point(i));}
 raw.reverse();
 const path=[{x:start.x,z:start.z},...raw],result=[];let i=0;
 while(i<path.length-1){
   let best=i+1;
   for(let j=path.length-1;j>i+1;j--){if(!lineBlocked(path[i].x,path[i].z,path[j].x,path[j].z,r,obstacles,b)){best=j;break;}}
   result.push(path[best]);i=best;
 }
 const tail=result.at(-1)??start;
 if(!isBlocked(goal.x,goal.z,r,obstacles,b)&&!lineBlocked(tail.x,tail.z,goal.x,goal.z,r,obstacles,b))result.push({x:goal.x,z:goal.z});
 return result;
}
