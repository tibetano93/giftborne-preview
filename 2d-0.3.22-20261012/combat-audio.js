/* Presentation of existing SIM facts. Shares app's context/master/12 voices. */
(function(root){
 'use strict';
 const MAX_VOICES=12,URL='assets/audio/combat-foley-v1.wav';
 const spans=Object.fromEntries(Object.entries({swingA:[0,6438],swingB:[9966,8290],metal:[21784,22050],body:[47362,19845],magic:[70735,37485]}).map(([id,v])=>[id,v.map(n=>n/44100)]));
 function cue(e){
  const vary=(e.id%3-1)*.035;
  if(e.k==='attack')return{sample:e.actionId%2?'swingA':'swingB',gain:.28,rate:1+vary,priority:1};
  if(e.k==='hit'&&Number.isFinite(e.damage)&&e.damage>0)return{sample:'metal',gain:.4,rate:1+vary,priority:3};
  if(e.k==='hurt'&&Number.isFinite(e.damage)&&e.damage>0)return{sample:'body',gain:.6,rate:.9,priority:5};
  if(e.k==='skill')return{sample:'magic',gain:.3,rate:e.gift==='orb'?1.15:1.4,priority:2};
  if(e.k==='dodge')return{sample:'swingB',gain:.2,rate:1.25,priority:1};
  if(e.k==='evade')return{sample:'swingA',gain:.36,rate:1.6,priority:4};
  if(e.k==='kill')return{sample:'body',gain:.3,rate:.7,priority:2};
  if(e.k==='lose')return{sample:'body',gain:.55,rate:.55,priority:6};
  if(e.k==='episodeComplete'||e.k==='win')return{sample:'magic',gain:.4,rate:.85,priority:4};
  return null; // contact/hits:0 never sounds like an impact; damage owns contact.
 }
 let bytesPromise;
 function preload(){return bytesPromise||=(fetch(URL).then(r=>{if(!r.ok)throw Error('combat audio '+r.status);return r.arrayBuffer();}).catch(()=>{bytesPromise=null;return null;}));}
 function create({context,master,voices,canPlay,onPlayed}){
  let buffer=null,loading=null,scheduled=0,dropped=0,stolen=0,maxActive=0;const history=[];
  function load(){if(buffer)return Promise.resolve(true);return loading||=(preload().then(bytes=>bytes?context.decodeAudioData(bytes.slice(0)):null).then(b=>{buffer=b;return !!b;}).catch(()=>{bytesPromise=null;return false;}).finally(()=>{loading=null;}));}
  function play(e){const c=cue(e);if(!c||!buffer||!canPlay()||context.state!=='running')return false;
   if(voices.size>=MAX_VOICES){const victim=[...voices.entries()].find(([,dispose])=>(dispose.priority||0)<c.priority);if(!victim){dropped++;return false;}try{victim[0].stop();}catch{}victim[1]();stolen++;}
   const node=context.createBufferSource(),gain=context.createGain(),[offset,duration]=spans[c.sample];node.buffer=buffer;node.playbackRate.value=c.rate;gain.gain.value=c.gain;node.connect(gain).connect(master);
   let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;node.onended=null;voices.delete(node);node.disconnect();gain.disconnect();};dispose.priority=c.priority;voices.set(node,dispose);node.onended=dispose;
   try{node.start(context.currentTime,offset,duration);}catch{dispose();return false;}
   scheduled++;onPlayed();maxActive=Math.max(maxActive,voices.size);history.push({eventId:e.id,kind:e.k,target:e.target||null,damage:e.damage||0,simTime:e.t,sample:c.sample,contextTime:context.currentTime});if(history.length>32)history.shift();return true;
  }
  return{load,play,get diagnostics(){return{ready:!!buffer,scheduled,dropped,stolen,maxActive,decodedBytes:buffer?buffer.length*buffer.numberOfChannels*4:0,history:history.map(e=>({...e}))}}};
 }
 const api={MAX_VOICES,URL,spans,cue,preload,create};root.COMBAT_AUDIO=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
