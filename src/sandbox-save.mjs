import {cleanCounts,maxBrace,sites} from "./sandbox.mjs";
import {encounterCap,encounterTypes,encounterZones} from "./encounters.mjs";
import {restoreCheckpoint,WORLD_LIMITS} from "./nav.mjs";

export const checkpointKey="ashfordRebirthV01";
export const checkpointVersion=2;
const fields=["stage","x","z","health","stamina","thirst","hunger","ammo","hasGun","supplies","inventory","kills","waveKills","time"];
const struct=value=>value&&typeof value==="object"&&!Array.isArray(value);
const safeSeed=(value,fallback)=>Number.isInteger(value)&&value>=0&&value<=0xffffffff?value:fallback;
const inside=(actor)=>Number.isFinite(actor?.x)&&Number.isFinite(actor?.z)&&actor.x>WORLD_LIMITS.minX&&actor.x<WORLD_LIMITS.maxX&&actor.z>WORLD_LIMITS.minZ&&actor.z<WORLD_LIMITS.maxZ;

export function restoreSandbox(value,seed){
 const data=struct(value)?value:{},looted={},encounters={};
 for(const {id} of sites)if(data.looted?.[id]===true)looted[id]=true;
 let active=null;
 for(const {id} of encounterZones){
  const entry=data.encounters?.[id];
  if(entry==="done")encounters[id]="done";
  if(entry!=="active")continue;
  const group=data.active?.id===id&&Array.isArray(data.active.actors)&&data.active.actors.length<=encounterCap
   ?data.active.actors.filter(actor=>inside(actor)&&encounterTypes.includes(actor.type)&&Number.isFinite(actor.hp)&&actor.hp>0)
    .map(({x,z,type,hp})=>({x,z,type,hp})):[];
  if(!active&&group.length){active={id,actors:group};encounters[id]="active";}
  else encounters[id]="done";
 }
 return {seed:safeSeed(data.seed,seed),looted,storage:cleanCounts(data.storage),
  brace:Number.isInteger(data.brace)?Math.min(maxBrace,Math.max(0,data.brace)):0,
  encounters,active};
}

export function readCheckpoint(saved,current,seed){
 if(!struct(saved))return null;
 if(saved.version!==undefined&&saved.version!==1&&saved.version!==checkpointVersion)return {unsupported:true};
 const parsed=restoreCheckpoint(saved,current);
 parsed.hasGun=typeof saved.hasGun==="boolean"?saved.hasGun:current.hasGun;
 if(parsed.stage===8&&saved.waveKills===4)parsed.waveKills=4;
 const v2=saved.version===checkpointVersion;
 parsed.inventory={water:0,food:0,bandage:0,...cleanCounts(v2?saved.inventory:parsed.inventory)};
 delete parsed.inventory.ammo;
 parsed.time=Number.isFinite(saved.time)?Math.min(1e8,Math.max(0,saved.time)):current.time;
 return {campaign:parsed,sandbox:restoreSandbox(saved.sandbox,seed),completed:saved.completed===true&&parsed.stage===8&&parsed.health>0};
}

export function makeCheckpoint(state,sandbox){
 const checkpoint={version:checkpointVersion,completed:Boolean(state.completed),sandbox};
 for(const key of fields)checkpoint[key]=state[key];
 return checkpoint;
}
