import test from "node:test";
import assert from "node:assert/strict";
import {items,sites,lootFor,takeLoot,craft,transfer,canBrace,crossesGate,changePack} from "../src/sandbox.mjs";
import {encounterZones,encounterCap,planEncounter,keepEncounter} from "../src/encounters.mjs";
import {readCheckpoint,makeCheckpoint,restoreSandbox} from "../src/sandbox-save.mjs";

const legacy={stage:5,x:20,z:-12,health:71,stamina:74,thirst:65,hunger:62,ammo:13,hasGun:true,supplies:1,inventory:{water:0,food:1,bandage:0},kills:2,waveKills:0};
const start={...legacy,stage:0,health:100,hasGun:false,supplies:0,inventory:{water:1,food:2,bandage:1},time:0};

test("seeded loot is stable, finite and weighted toward its location",()=>{
 const cabinet=sites.find(site=>site.id==="clinic-stock");
 const sample=Array.from({length:150},(_,seed)=>lootFor(seed,cabinet));
 assert.deepEqual(sample,Array.from({length:150},(_,seed)=>lootFor(seed,cabinet)));
 assert(sample.some(stock=>stock.bandage)&&sample.some(stock=>stock.firstAid));
 assert(sample.every(stock=>stock.antiseptic>=2&&!stock.wood));
 assert.equal(new Set(sites.map(site=>site.id)).size,sites.length);
});

test("loot claims and stack capacity commit together",()=>{
 const site=sites[0],sandbox=restoreSandbox(null,37),pack={wood:items.wood.limit};
 assert.equal(takeLoot(sandbox,pack,site).error,"Pack is full");
 assert.deepEqual(sandbox.looted,{});
 assert.equal(pack.wood,items.wood.limit);
 const taken=takeLoot(sandbox,{},site);
 assert.equal(taken.pack.wood,1);
 assert.equal(takeLoot({...sandbox,looted:taken.looted},taken.pack,site).error,"Already searched");
});

test("crafting rejects missing or capped ingredients without mutation",()=>{
 const before={cloth:1,antiseptic:1,bandage:items.bandage.limit};
 assert.equal(craft(before,"bandage").error,"Pack is full");
 assert.equal(craft({cloth:3},"bandage").error,"Missing materials");
 assert.deepEqual(before,{cloth:1,antiseptic:1,bandage:99});
 assert.equal(changePack(before,{cloth:-1}).error,"Missing materials");
 const bandage=craft({cloth:1,antiseptic:1},"bandage").pack;
 assert.deepEqual(bandage,{cloth:0,antiseptic:0,bandage:1});
 assert.equal(craft({...bandage,antiseptic:2},"firstAid").pack.firstAid,1);
});

test("one-unit storage is conserved and bracing consumes the crafted kit",()=>{
 const built=craft({wood:2,scrap:1},"brace").pack;
 assert.equal(canBrace(built,0).pack.brace,0);
 assert.equal(canBrace(built,2).error,"Gate fully braced");
 const {from,to}=transfer(built,{},"brace");
 assert.equal(from.brace,0);
 assert.equal(to.brace,1);
 assert.equal(transfer(to,{brace:2},"brace").error,"Pack is full");
 assert.equal(transfer(to,from,"brace").to.brace,1);
 assert(crossesGate(-47,-13,-47,-16));
 assert(!crossesGate(-47,-16,-47,-13));
 assert(!crossesGate(-54,-13,-54,-16));
});

test("legacy saves retain progress, depleted stacks and preferences outside the checkpoint",()=>{
 const loaded=readCheckpoint(legacy,start,37);
 assert.deepEqual(loaded.campaign.inventory,{water:0,food:1,bandage:0});
 assert.equal(loaded.campaign.stage,5);
 assert.equal(loaded.campaign.ammo,13);
 assert.equal(loaded.campaign.hasGun,true);
 assert.equal(loaded.campaign.supplies,1);
 assert.equal(loaded.sandbox.seed,37);
 const checkpoint=makeCheckpoint(loaded.campaign,loaded.sandbox);
 assert.deepEqual(readCheckpoint(checkpoint,start,91).campaign.inventory,legacy.inventory);
 assert.equal(readCheckpoint(checkpoint,start,91).sandbox.seed,37);
 assert.deepEqual(readCheckpoint({...checkpoint,version:424},start,37),{unsupported:true});
});

test("corrupted sandbox data is repaired without discarding a valid campaign",()=>{
 const saved={...legacy,version:2,inventory:{cloth:-7,wood:3.1,bandage:0,water:73,ammo:900},
  sandbox:{seed:-1,storage:{water:400,wood:-1,bogus:12},brace:8,
   looted:{"safehouse-kit":true,"road-trunk":"yes",fake:true},encounters:{market:"active",road:"done"},
   active:{id:"market",actors:[{x:Infinity,z:0,type:"walker",hp:12}]}}};
 const loaded=readCheckpoint(saved,start,47);
 assert.deepEqual(loaded.campaign.inventory,{water:73,food:0,bandage:0});
 assert.equal(loaded.campaign.ammo,13);
 assert.deepEqual(loaded.sandbox.storage,{water:99});
 assert.deepEqual(loaded.sandbox.looted,{"safehouse-kit":true});
 assert.equal(loaded.sandbox.brace,2);
 assert.equal(loaded.sandbox.active,null);
 assert.deepEqual(loaded.sandbox.encounters,{market:"done",road:"done"});
});

test("encounter placement is deterministic, rejects unusable candidates and caps survivors",()=>{
 const zone=encounterZones[0],plan=planEncounter(12,zone,({x})=>x<0);
 assert(plan.length>0&&plan.length<=encounterCap);
 assert.deepEqual(plan,planEncounter(12,zone,({x})=>x<0));
 assert.deepEqual(planEncounter(12,zone,()=>false),[]);
 assert(keepEncounter(plan[0],{x:0,z:0}));
 assert(!keepEncounter(plan[0],{x:73,z:40}));
 const persisted=restoreSandbox({encounters:{market:"active"},active:{id:"market",actors:plan.map(actor=>({...actor,hp:22}))}},12);
 assert.equal(persisted.active.actors.length,plan.length);
 assert.equal(persisted.active.actors[0].hp,22);
});
