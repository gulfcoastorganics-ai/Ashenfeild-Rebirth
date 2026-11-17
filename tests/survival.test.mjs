import test from "node:test";
import assert from "node:assert/strict";
import {DODGE,canDodge,normalize2D,summarizeFrames} from "../src/survival.mjs";

test("dodge requires stamina and cooldown",()=>{
 assert.equal(canDodge(100,0,false),true);
 assert.equal(canDodge(21,0,false),false);
 assert.equal(canDodge(100,.2,false),false);
 assert.equal(canDodge(100,0,true),false);
 assert(DODGE.invulnerability<DODGE.duration);
 assert(DODGE.duration<DODGE.cooldown);
});
test("dodge direction normalized and safe fallback",()=>{
 assert.deepEqual(normalize2D(3,4),{x:.6,z:.8});
 assert.deepEqual(normalize2D(0,0),{x:0,z:1});
 assert.deepEqual(normalize2D(NaN,3),{x:0,z:1});
});
test("frame statistics ignore invalid samples and compute p95",()=>{
 assert.deepEqual(summarizeFrames([]),{samples:0,fps:0,meanMs:0,p50Ms:0,p95Ms:0});
 const s=summarizeFrames([10,20,30,40,50,NaN,-1]);
 assert.deepEqual(s,{samples:5,fps:33.3,meanMs:30,p50Ms:30,p95Ms:50});
});
