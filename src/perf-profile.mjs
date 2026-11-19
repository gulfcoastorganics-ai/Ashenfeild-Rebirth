const phases=["effects and input","simulation","camera and world","animation","render submission"];

export function createFrameProfile(){
 const limit=60,windows=phases.map(()=>new Float64Array(limit));
 let slot=0,filled=0,timestamp=0,step=0;
 return {
  enabled:false,
  start(){timestamp=performance.now();step=0;},
  mark(){
   const now=performance.now();
   windows[step++][slot]=now-timestamp;
   timestamp=now;
   if(step===phases.length){slot=(slot+1)%limit;filled=Math.min(limit,filled+1);}
  },
  summary(){
   return Object.fromEntries(phases.map((phase,index)=>{
    const samples=Array.from(windows[index].subarray(0,filled)).sort((a,b)=>a-b);
    return [phase,{samples:filled,p50:samples[Math.ceil(filled*.50)-1]??null,p95:samples[Math.ceil(filled*.95)-1]??null}];
   }));
  }
 };
}
