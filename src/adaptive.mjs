// Auto quality uses warmed frame-time windows. User-selected presets bypass it.
export function createQualityGovernor(constrained=false){
 const origin=constrained?0:2;
 let level=origin,elapsed=0,bad=0,good=0,cooldown=0;
 const frames=[];
 const state=()=>({tier:level===0?"performance":"balanced",rigs:level===2,level});
 return {
  state,
  reset(restore=false){
   if(restore){level=origin;cooldown=0;}
   elapsed=bad=good=0;frames.length=0;
   return state();
  },
  sample(seconds){
   if(!Number.isFinite(seconds)||seconds<=0)return null;
   if(seconds>.75){elapsed=bad=good=0;frames.length=0;return null;}
   elapsed+=seconds;cooldown=Math.max(0,cooldown-seconds);frames.push(seconds*1000);
   if(elapsed<2)return null;
   frames.sort((a,b)=>a-b);
   const p50=frames[Math.floor((frames.length-1)*.5)],p95=frames[Math.floor((frames.length-1)*.95)];
   elapsed=0;frames.length=0;
   bad=p50>38||p95>67?bad+1:0;
   good=p50<21&&p95<34?good+1:0;
   const next=bad>=2?Math.max(0,level-1):good>=4?Math.min(2,level+1):level;
   if(cooldown>0||next===level)return null;
   level=next;bad=good=0;cooldown=6;
   return state();
  }
 };
}

export function animationInterval({distance,tier,visible,urgent}){
 if(urgent)return 0;
 if(!visible)return .22;
 if(distance<9)return tier==="performance"?1/30:0;
 return distance<18?(tier==="quality"?1/24:1/15):1/10;
}
