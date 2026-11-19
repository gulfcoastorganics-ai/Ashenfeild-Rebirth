export const items=Object.freeze({
 water:{label:"Bottled water",limit:99,stat:"thirst",effect:42},
 food:{label:"Canned food",limit:99,stat:"hunger",effect:38},
 bandage:{label:"Bandage",limit:99,stat:"health",effect:40},
 firstAid:{label:"First-aid kit",limit:5,stat:"health",effect:72},
 cloth:{label:"Cloth",limit:12},
 antiseptic:{label:"Antiseptic",limit:10},
 wood:{label:"Salvaged wood",limit:12},
 scrap:{label:"Scrap metal",limit:12},
 parts:{label:"Mechanical parts",limit:10},
 brace:{label:"Door brace kit",limit:2},
 ammo:{label:"Pistol rounds",limit:999}
});

export const recipes=Object.freeze({
 bandage:{cloth:1,antiseptic:1},
 firstAid:{bandage:1,antiseptic:2},
 brace:{wood:2,scrap:1}
});

export const stash={name:"Safehouse locker",x:-54,z:-28.65,range:2.6};
export const doorway={name:"Safehouse gate",x:-47,z:-16.5,range:2.55};
export const maxBrace=2;
export const sites=Object.freeze([
 {id:"safehouse-kit",name:"Safehouse footlocker",x:-42,z:-24,range:2.6,room:0,stock:{wood:1,cloth:1},zone:"house"},
 {id:"safehouse-crate",name:"Workshop crate",x:-43,z:-32.8,range:2.5,room:0,stock:{wood:1,cloth:1},zone:"house"},
 {id:"market-stock",name:"Market lower shelf",x:-5.7,z:-21,range:2.5,room:1,stock:{wood:1,scrap:1},zone:"market"},
 {id:"market-service",name:"Market service box",x:-18,z:-32.5,range:2.5,room:1,stock:{food:1},zone:"market"},
 {id:"road-salvage",name:"Roadside tool case",x:1.4,z:8.8,range:2.5,room:-1,stock:{wood:1,scrap:1},zone:"road"},
 {id:"road-trunk",name:"Abandoned sedan trunk",x:-67.4,z:17,range:2.5,room:-1,stock:{scrap:1},zone:"road"},
 {id:"clinic-stock",name:"Clinic medical cabinet",x:56,z:-20,range:2.55,room:2,stock:{antiseptic:2},zone:"clinic"},
 {id:"clinic-tray",name:"Ward service tray",x:40.6,z:-36.36,range:2.5,room:2,stock:{bandage:1},zone:"clinic"}
]);
const lootTables={
 house:[["cloth",3],["water",2],["antiseptic",2]],
 market:[["food",4],["water",4],["cloth",2],["antiseptic",1]],
 road:[["scrap",4],["parts",4],["ammo",2,4]],
 clinic:[["bandage",4],["antiseptic",4],["firstAid",1],["water",1]]
};

export function seedFor(seed,id){
 let hash=(seed^2166136261)>>>0;
 for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return hash>>>0;
}

export function lootFor(seed,site){
 const weights=lootTables[site.zone];
 let entry=seedFor(seed,site.id)%weights.reduce((total,[,weight])=>total+weight,0);
 const loot={...site.stock};
 for(const [id,weight,count=1] of weights){
  if(entry<weight){loot[id]=(loot[id]??0)+count;break;}
  entry-=weight;
 }
 return loot;
}

export function cleanCounts(source,fallback={}){
 const result={};
 for(const [id,{limit}] of Object.entries(items)){
  const number=source&&Object.hasOwn(source,id)?source[id]:fallback[id];
  if(Number.isInteger(number)&&number>0)result[id]=Math.min(limit,number);
 }
 return result;
}

// Plan the entire mutation before writing. Same transaction path for loot and recipes.
export function changePack(pack,cost={},gain={}){
 const next={...pack};
 for(const [id,count] of Object.entries(cost)){
  if(!Object.hasOwn(items,id)||!Number.isInteger(count)||count<1||(next[id]??0)<count)return {error:"Missing materials"};
  next[id]-=count;
 }
 for(const [id,count] of Object.entries(gain)){
  if(!Object.hasOwn(items,id)||!Number.isInteger(count)||count<1||(next[id]??0)+count>items[id].limit)return {error:"Pack is full"};
  next[id]=(next[id]??0)+count;
 }
 return {pack:next};
}

export function craft(pack,id){
 const cost=Object.hasOwn(recipes,id)?recipes[id]:null;
 return cost?changePack(pack,cost,{[id]:1}):{error:"Unknown recipe"};
}

export function transfer(from,to,id){
 if(!Object.hasOwn(items,id)||(from[id]??0)<1)return {error:"No item to move"};
 const destination=changePack(to,{}, {[id]:1});
 if(destination.error)return destination;
 return {from:changePack(from,{[id]:1}).pack,to:destination.pack};
}

export function takeLoot(sandbox,pack,site){
 if(sandbox.looted[site.id])return {error:"Already searched"};
 const loot=lootFor(sandbox.seed,site),result=changePack(pack,{},loot);
 if(result.error)return result;
 return {pack:result.pack,loot,looted:{...sandbox.looted,[site.id]:true}};
}

export function canBrace(pack,level){
 if(level>=maxBrace)return {error:"Gate fully braced"};
 return changePack(pack,{brace:1});
}

export function crossesGate(fromX,fromZ,toX,toZ){
 const front=-14.5;
 if(fromZ<front||toZ>=front)return false;
 const crossing=fromX+(toX-fromX)*(front-fromZ)/(toZ-fromZ);
 return Math.abs(crossing-doorway.x)<3.85;
}
