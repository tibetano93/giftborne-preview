/* Device preferences only. Never reads or writes the campaign/inventory save. */
(function(root){
 'use strict';
 const KEY='giftborne-2d-preferences-v1',DEFAULTS=Object.freeze({version:1,quality:'balanced',audioEnabled:false,volume:60,hints:true,reduceMotion:false,stickSensitivity:100});
 const number=(v,lo,hi,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):fallback;
 function normalize(value){const v=value&&typeof value==='object'&&value.version===1?value:{};return{version:1,quality:v.quality==='low'?'low':'balanced',audioEnabled:typeof v.audioEnabled==='boolean'?v.audioEnabled:DEFAULTS.audioEnabled,volume:number(v.volume,0,100,DEFAULTS.volume),hints:typeof v.hints==='boolean'?v.hints:DEFAULTS.hints,reduceMotion:typeof v.reduceMotion==='boolean'?v.reduceMotion:DEFAULTS.reduceMotion,stickSensitivity:number(v.stickSensitivity,75,125,DEFAULTS.stickSensitivity)};}
 function effective(value,systemReduced=false){const v=normalize(value);return{...v,reduceMotion:v.reduceMotion||systemReduced,quality:systemReduced?'low':v.quality};}
 function stick(dx,dy,radius,sensitivity=100){if(![dx,dy,radius].every(Number.isFinite)||radius<=0)return{mx:0,my:0};const d=Math.hypot(dx,dy),k=Math.min(1,d/radius*number(sensitivity,75,125,100)/100);return{mx:d>4?dx/d*k:0,my:d>4?dy/d*k:0};}
 function create(storage){let current;try{current=normalize(JSON.parse(storage.getItem(KEY)||'null'));}catch{current=normalize(null);}
  return{get value(){return{...current};},apply(value){current=normalize(value);let saved=false;try{storage.setItem(KEY,JSON.stringify(current));saved=true;}catch{}return{value:{...current},saved};}};
 }
 const api={KEY,DEFAULTS,normalize,effective,stick,create};root.PREFERENCES=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
