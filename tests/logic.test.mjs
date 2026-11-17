import test from "node:test";
import assert from "node:assert/strict";
import {WORLD_LIMITS,ENTRANCES,isBlocked,lineBlocked,chaseGoal,findPath,clampFinite,restoreCheckpoint} from "../src/nav.mjs";

const clinicFront=[
 {x:34.25,z:-13,w:9.5,d:.7},
 {x:54.75,z:-13,w:11.5,d:.7}
];
test("collision bounds reject unreachable outer world",()=>{
 assert.equal(isBlocked(-75,0),true);
 assert.equal(isBlocked(0,-56),true);
 assert.equal(isBlocked(0,0),false);
 assert.ok(WORLD_LIMITS.minX<WORLD_LIMITS.maxX);
});
test("clinic facade blocks players while main entrance stays open",()=>{
 assert.equal(isBlocked(35,-13,.35,clinicFront),true);
 assert.equal(isBlocked(55,-13,.35,clinicFront),true);
 assert.equal(isBlocked(44,-13,.35,clinicFront),false);
});
test("combat line-of-sight cannot pass through walls",()=>{
 assert.equal(lineBlocked(35,-9,35,-20,.12,clinicFront),true);
 assert.equal(lineBlocked(44,-9,44,-20,.12,clinicFront),false);
});
test("enemy seeking indoor player approaches doorway then enters",()=>{
 const player={x:48,z:-28};
 let enemy={x:61,z:4};
 assert.deepEqual(chaseGoal(enemy,player),{x:44,z:-10.7});
 enemy={x:44,z:-10.7};
 assert.deepEqual(chaseGoal(enemy,player),{x:44,z:-16.2});
 enemy={x:44,z:-17};
 assert.deepEqual(chaseGoal(enemy,player),player);
});
test("safe outdoor chase remains direct",()=>{
 const player={x:17,z:3};
 assert.deepEqual(chaseGoal({x:1,z:8},player),player);
 assert.equal(ENTRANCES.length,3);
});
test("checkpoint clamps malformed and out-of-bounds values",()=>{
 const current={stage:0,x:-48,z:-24,health:100,stamina:100,thirst:80,hunger:80,
 ammo:0,hasGun:false,supplies:0,kills:0,waveKills:0,inventory:{water:1,food:2,bandage:1}};
 const s=restoreCheckpoint({stage:100,x:999,z:-999,health:-30,stamina:500,thirst:"bad",ammo:Infinity,
 hasGun:true,supplies:8,inventory:{water:-7,food:1000,bandage:2}},current);
 assert.equal(s.stage,8);
 assert.equal(s.x,73);
 assert.equal(s.z,-54);
 assert.equal(s.health,0);
 assert.equal(s.stamina,100);
 assert.equal(s.thirst,80);
 assert.equal(s.ammo,0);
 assert.equal(s.hasGun,true);
 assert.equal(s.supplies,1);
 assert.deepEqual(s.inventory,{water:0,food:99,bandage:2});
 assert.equal(clampFinite(NaN,0,100,12),12);
});
test("missing save data defaults to current state",()=>{
 const current={stage:3,x:0,z:0,inventory:{water:1}};
 const restored=restoreCheckpoint(null,current);
 assert.notEqual(restored,current);
 assert.equal(restored.stage,3);
});


test("A* routes infected around a long solid wall without passing through it",()=>{
 const wall=[{x:0,z:0,w:1.5,d:22}];
 const start={x:-8,z:0},goal={x:8,z:0};
 const path=findPath(start,goal,wall,{step:1.75,clearance:.45});
 assert(path.length>=3,"Expected route around the barrier rather than through it");
 let last=start;
 for(const waypoint of path){
   assert.equal(lineBlocked(last.x,last.z,waypoint.x,waypoint.z,.45,wall),false,"Path segment intersects wall");
   last=waypoint;
 }
 assert(Math.hypot(last.x-goal.x,last.z-goal.z)<.01,"A* did not reach goal");
});
test("A* returns direct waypoint for unobstructed path",()=>{
 assert.deepEqual(findPath({x:-15,z:3},{x:4,z:3},[]),[{x:4,z:3}]);
});
test("A* enters clinic through an open entrance",()=>{
 const clinic=[
  {x:29.5,z:-26,w:.7,d:26},{x:60.5,z:-26,w:.7,d:26},
  {x:34.25,z:-13,w:9.5,d:.7},{x:54.75,z:-13,w:11.5,d:.7},
  {x:45,z:-39,w:31,d:.7}
 ];
 const start={x:28,z:-5},goal={x:48,z:-28},path=findPath(start,goal,clinic);
 assert(path.length>1,"Expected a non-direct path through clinic doorway");
 let last=start;
 for(const point of path){assert.equal(lineBlocked(last.x,last.z,point.x,point.z,.45,clinic),false);last=point;}
 assert(Math.hypot(last.x-goal.x,last.z-goal.z)<.1);
});
test("A* does not invent paths to fully enclosed space",()=>{
 const enclosure=[{x:-2,z:0,w:.6,d:8},{x:2,z:0,w:.6,d:8},{x:0,z:-4,w:4,d:.6},{x:0,z:4,w:4,d:.6}];
 assert.deepEqual(findPath({x:8,z:8},{x:0,z:0},enclosure),[]);
});
test("A* rejects invalid or excessive grid sizes",()=>{
 assert.deepEqual(findPath({x:NaN,z:0},{x:2,z:2},[]),[]);
 assert.deepEqual(findPath({x:0,z:0},{x:2,z:2},[{x:1,z:1,w:1,d:1}],{step:.2}),[]);
});
