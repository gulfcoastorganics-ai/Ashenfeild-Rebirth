const footsteps={
 wood:{frequency:152,volume:.25,ring:106},
 tile:{frequency:1170,volume:.25,ring:212},
 asphalt:{frequency:570,volume:.19,ring:89}
};

export function createAudio(){
 let context,master,noise,wind;
 let volume=.65,ambience=0,eventSeed=93767;
 const vary=()=>((eventSeed=(Math.imul(eventSeed,1664525)+1013904223)>>>0)/4294967296);
 function setup(){
  if(context)return true;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return false;
  try{context=new Audio();}catch{return false;}
  master=context.createGain();
  master.gain.value=volume;
  const limiter=context.createDynamicsCompressor();
  limiter.threshold.value=-14;
  limiter.ratio.value=8;
  master.connect(limiter);limiter.connect(context.destination);
  noise=context.createBuffer(1,context.sampleRate*3,context.sampleRate);
  const data=noise.getChannelData(0);
  let seed=48791;
  for(let i=0;i<data.length;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   data[i]=seed/2147483648-1;
  }
  return true;
 }
 function windBed(){
  const source=context.createBufferSource();
  source.buffer=noise;source.loop=true;
  const filter=context.createBiquadFilter();
  filter.type="lowpass";filter.frequency.value=170;
  wind=context.createGain();wind.gain.value=ambience;
  source.connect(filter);filter.connect(wind);wind.connect(master);
  source.start();
 }
 function unlock(){
  if(!setup())return;
  if(!wind)windBed();
  if(context.state!=="running")context.resume().catch(()=>{});
 }
 function voice(source,filter,peak,duration,pan,offset){
  const t=context.currentTime;
  const amp=context.createGain();
  amp.gain.setValueAtTime(.0001,t);
  amp.gain.linearRampToValueAtTime(peak,t+.006);
  amp.gain.exponentialRampToValueAtTime(.0001,t+duration);
  if(filter){source.connect(filter);filter.connect(amp);}else source.connect(amp);
  if(pan&&context.createStereoPanner){
   const panner=context.createStereoPanner();panner.pan.value=pan;
   amp.connect(panner);panner.connect(master);
  }else amp.connect(master);
  if(offset===undefined)source.start(t);else source.start(t,offset);
  source.stop(t+duration+.015);
 }
 function tone(frequency,duration=.12,wave="sine",level=.04,pan=0){
  if(context?.state!=="running"||volume===0)return;
  const oscillator=context.createOscillator(),now=context.currentTime;
  oscillator.type=wave;
  oscillator.frequency.setValueAtTime(frequency,now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(24,frequency*.63),now+duration);
  voice(oscillator,null,level,duration,pan);
 }
 function burst(frequency,duration,level,pan=0,filterType="bandpass"){
  if(context?.state!=="running"||volume===0)return;
  const source=context.createBufferSource();
  source.buffer=noise;source.loop=true;
  const filter=context.createBiquadFilter();
  filter.type=filterType;filter.frequency.value=frequency;filter.Q.value=.58;
  voice(source,filter,level,duration,pan,vary()*2.2);
 }
 return {
  unlock,tone,burst,
  setVolume(value){
   volume=value;
   if(master)master.gain.setTargetAtTime(value,context.currentTime,.06);
  },
  ambience(indoors,playing){
   const level=playing?(indoors?.016:.08):0;
   if(level===ambience)return;
   ambience=level;
   if(wind)wind.gain.setTargetAtTime(level,context.currentTime,.32);
  },
  footstep(surface,sprinting,left){
   const step=footsteps[surface],pan=left?-.10:.10,strength=sprinting?1.25:1;
   burst(step.frequency*(.85+vary()*.3),.126,step.volume*strength,pan);
   tone(step.ring*(sprinting?.86:.94),sprinting?.114:.103,"sine",.073*strength,pan);
  }
 };
}
