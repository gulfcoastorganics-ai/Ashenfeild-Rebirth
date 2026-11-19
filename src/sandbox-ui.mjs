import {items,recipes,lootFor,maxBrace} from "./sandbox.mjs";

const $=id=>document.getElementById(id);
export const describeCounts=counts=>Object.entries(counts).filter(([,n])=>n>0).map(([id,n])=>items[id].label+" ×"+n).join(" · ");

function button(label,detail,activate,className="ghost"){
 const el=document.createElement("button");
 el.type="button";el.className=className;el.disabled=!activate;
 const title=document.createElement("span");
 title.className="inv-name";title.textContent=label;el.append(title);
 if(detail){
  const count=document.createElement("span");count.className="inv-count";count.textContent=detail;el.append(count);
 }
 if(activate)el.onclick=activate;
 return el;
}

export function renderPack({tab,pack,hasGun,supplies,status,use,make}){
 $("pack-tab").setAttribute("aria-pressed",String(tab==="pack"));
 $("craft-tab").setAttribute("aria-pressed",String(tab==="craft"));
 $("pack-status").hidden=!status;$("pack-status").textContent=status;
 const entries=$("inventory-items");entries.replaceChildren();
 if(tab==="craft"){
  for(const [id,cost] of Object.entries(recipes)){
   const ingredients=Object.entries(cost).map(([ingredient,n])=>items[ingredient].label+" "+(pack[ingredient]??0)+"/"+n).join(" · ");
   entries.append(button("CRAFT "+items[id].label.toUpperCase(),ingredients,()=>make(id),"inv-cell"));
  }
  return;
 }
 entries.append(button("CROWBAR","Equipped",null,"inv-cell"));
 entries.append(button("PISTOL",hasGun?"Equipped":"Not recovered",null,"inv-cell"));
 entries.append(button("MEDICAL SUPPLIES",supplies?"Campaign item":"Not recovered",null,"inv-cell"));
 const staples=["water","food","bandage","ammo"];
 for(const id of Object.keys(items)){
  const count=pack[id]??0;
  if(count<=0&&!staples.includes(id))continue;
  const item=items[id];
  const usable=count>0&&item.stat;
  const detail=count+" / "+item.limit+(usable?" · Use":"");
  entries.append(button(item.label.toUpperCase(),detail,usable?()=>use(id):null,"inv-cell"));
 }
}

export function renderField(target,{sandbox,pack,status,take,move,brace}){
 $("field-label").textContent=target.kind==="loot"?"SCAVENGE":"SAFEHOUSE";
 $("field-title").textContent=target.name;
 const entries=$("field-items");entries.replaceChildren();
 let detail;
 if(target.kind==="loot"){
  const empty=sandbox.looted[target.id];
  detail=empty?"Already searched. Nothing remains.":describeCounts(lootFor(sandbox.seed,target));
  if(!empty)entries.append(button("TAKE SUPPLIES",null,take,"primary"));
 }
 if(target.kind==="storage"){
  detail="Locker: "+(describeCounts(sandbox.storage)||"empty");
  for(const id of Object.keys(items)){
   if(pack[id]>0)entries.append(button("STORE "+items[id].label.toUpperCase(),"Pack ×"+pack[id],()=>move(id,true)));
   if(sandbox.storage[id]>0)entries.append(button("TAKE "+items[id].label.toUpperCase(),"Locker ×"+sandbox.storage[id],()=>move(id,false)));
  }
 }
 if(target.kind==="gate"){
  const state=["Unbraced. Craft a door brace kit in your pack.","Braced. The entry holds back infected.","Plated. The entry also blocks spit."][sandbox.brace];
  detail=state+" Door brace kits ×"+(pack.brace??0)+".";
  if(sandbox.brace<maxBrace)entries.append(button("INSTALL BRACE KIT",null,brace,"primary"));
 }
 $("field-status").textContent=status?detail+" "+status:detail;
}
