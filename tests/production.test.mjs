import test from "node:test";
import assert from "node:assert/strict";
import {createQualityGovernor,animationInterval} from "../src/adaptive.mjs";
import {cameraClearance,cameraArm,damageSide} from "../src/camera.mjs";
import {createBrain,sense,separation} from "../src/infected-ai.mjs";
import {lineBlocked} from "../src/nav.mjs";

function feed(governor,frame,seconds){
 const changes=[];
 for(let i=0;i<Math.floor(seconds/frame);i++){
  const change=governor.sample(frame);if(change)changes.push(change.level);
 }
 return changes;
}

test("adaptive quality drops rigs before resolution and recovers with sustained headroom",()=>{
 const governor=createQualityGovernor();
 assert.equal(governor.state().level,2);
 assert.deepEqual(feed(governor,.06,2.5),[]);
 assert.deepEqual(feed(governor,.06,3),[1]);
 assert.deepEqual(feed(governor,.06,9),[0]);
 assert.deepEqual(feed(governor,.016,3),[]);
 assert.deepEqual(feed(governor,.016,18),[1,2]);
});

test("a single stalled frame does not trigger a downgrade, constrained startup is lightweight",()=>{
 const governor=createQualityGovernor(true);
 assert.deepEqual(governor.state(),{tier:"performance",rigs:false,level:0});
 assert.equal(governor.sample(8),null);
 assert.equal(governor.reset(true).level,0);
 assert.equal(animationInterval({distance:23,tier:"balanced",visible:true,urgent:true}),0);
 assert(animationInterval({distance:23,tier:"balanced",visible:false,urgent:false})>.20);
});

test("camera sweeps its near plane along the shoulder and retracts faster than it recovers",()=>{
 const wall={min:{x:.21,y:0,z:2},max:{x:2,y:4,z:3}};
 const origin={x:0,y:2,z:0},target={x:0,y:2,z:5};
 assert.equal(cameraClearance(origin,target,[wall],0),1);
 assert(Math.abs(cameraClearance(origin,target,[wall])-.346)<1e-6);
 assert.equal(cameraArm(1,.35,.016),.35);
 const recovering=cameraArm(.35,1,.016);
 assert(recovering>.35&&recovering<.5);
 assert.equal(damageSide(0,0,4),"rear");
 assert.equal(damageSide(0,-5,1),"left");
});

test("infected sight is gated, sound starts an investigation, and memory expires",()=>{
 const brain=createBrain("walker",0,0);
 const player={x:0,z:7},actor={x:0,z:0};
 let scans=0,covered=true;
 const scan=(time,heard)=>sense(brain,{now:time,player,actor,distance:7,facing:1,alarm:false,heard,
  sight:()=>{scans++;return !covered;}});
 scan(0);scan(.05);assert.equal(scans,1);assert.equal(brain.mode,"idle");
 scan(.1,{id:1,x:3,z:6});assert.equal(brain.mode,"suspicious");
 scan(.53);assert.equal(brain.mode,"investigate");
 covered=false;scan(.8);assert.equal(brain.mode,"pursue");
 covered=true;scan(1.05);assert.equal(brain.mode,"search");
 scan(8);assert.equal(brain.mode,"patrol");
 const solid=[{x:0,z:3.5,w:5,d:.3}];
 assert(lineBlocked(actor.x,actor.z,player.x,player.z,.1,solid));
});

test("stacked infected separate in opposite directions and steering is bounded",()=>{
 const a={x:2,z:4,order:0},b={x:2,z:4,order:1},far={x:40,z:4,order:2};
 assert(separation(a,[a,b,far]).x<0);
 assert(separation(b,[a,b,far]).x>0);
 assert(Math.hypot(...Object.values(separation(a,[a,b,far])))<=.8);
});
