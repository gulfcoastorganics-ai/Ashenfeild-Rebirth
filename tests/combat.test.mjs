import test from "node:test";
import assert from "node:assert/strict";
import {WEAPONS,INFECTED,chooseTarget,applyHit,chooseInfectedAction,attackStillValid} from "../src/combat.mjs";

test("weapon damage and infected health are coherent",()=>{
 assert(WEAPONS.crowbar.range<WEAPONS.pistol.range);
 for(const e of Object.values(INFECTED)){assert(e.health>0&&e.meleeWindup>0&&e.meleeCooldown>=e.meleeWindup);}
 assert(INFECTED.brute.health>INFECTED.runner.health);
});
test("pistol targets enemy in forward cone, not one behind",()=>{
 const origin={x:0,z:0},forward={x:0,z:1};
 const e1={type:"walker",x:0,z:8,hp:75},e2={type:"walker",x:0,z:-3,hp:75};
 assert.equal(chooseTarget(origin,forward,[e1,e2],"pistol"),e1);
 assert.equal(chooseTarget(origin,forward,[e2],"pistol"),null);
});
test("cover prevents gun damage and melee does not reach distant enemy",()=>{
 const wall=[{x:0,z:3,w:5,d:.6}],target={x:0,z:6,hp:75};
 assert.equal(chooseTarget({x:0,z:0},{x:0,z:1},[target],"pistol",wall),null);
 assert.equal(chooseTarget({x:0,z:0},{x:0,z:1},[target],"crowbar",[]),null);
});
test("melee uses a proper forward arc, excludes dead enemies",()=>{
 const alive={x:.7,z:1.8,hp:75,dead:false};
 const dead={x:0,z:1,hp:0,dead:true};
 assert.equal(chooseTarget({x:0,z:0},{x:0,z:1},[dead,alive],"crowbar"),alive);
 assert.equal(chooseTarget({x:0,z:0},{x:0,z:-1},[alive],"crowbar"),null);
});
test("damage clamps and kills exactly once",()=>{
 assert.deepEqual(applyHit(75,55),{health:20,damage:55,killed:false});
 assert.deepEqual(applyHit(20,68),{health:0,damage:20,killed:true});
 assert.deepEqual(applyHit(0,68),{health:0,damage:0,killed:false});
 assert.deepEqual(applyHit(75,-40),{health:75,damage:0,killed:false});
});
test("infected attacks have distinct recoverable windups",()=>{
 const brute=chooseInfectedAction("brute",1.1,true);
 const runner=chooseInfectedAction("runner",1.1,true);
 const spit=chooseInfectedAction("spitter",8,true);
 assert(brute.windup>runner.windup);
 assert.equal(spit.kind,"spit");
 assert.equal(chooseInfectedAction("spitter",8,false),null);
 assert.equal(chooseInfectedAction("walker",8,true),null);
 assert(attackStillValid(spit,8,true));
 assert(!attackStillValid(spit,1.5,true));
 assert(!attackStillValid(brute,3,true));
 assert(!attackStillValid(brute,1,false));
});
