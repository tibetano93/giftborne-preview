/* Local deterministic inventory rules. This catalogue is a DEV kit, NOT
 * Telegram ownership, transferable assets, a reward ledger or market value. */
(function(root){
 'use strict';
 const W=6,H=4;
 const SLOTS=Object.freeze({helm:'Шлем',armor:'Доспехи',shoulders:'Плечи',belt:'Пояс',gloves:'Рукавицы',boots:'Сапоги',ring1:'Кольцо I',ring2:'Кольцо II',amulet:'Амулет',leftHand:'Левая рука',rightHand:'Правая рука'});
 const raw={
  sword:{name:'Light Sword · Absinthe',w:1,h:3,slots:['rightHand'],gift:'sword',image:'gift_sword.png'},
  orb:{name:'Crystal Ball · Seeing Red',w:2,h:2,slots:['rightHand'],gift:'orb',image:'gift_orb.png'},
  helm:{name:'Шлем паломника',w:2,h:2,slots:['helm'],hp:5},
  armor:{name:'Доспех паломника',w:2,h:3,slots:['armor'],hp:12},
  shoulders:{name:'Наплечники паломника',w:2,h:1,slots:['shoulders'],hp:5},
  belt:{name:'Пояс паломника',w:2,h:1,slots:['belt'],hp:3},
  gloves:{name:'Рукавицы паломника',w:2,h:2,slots:['gloves'],hp:3},
  boots:{name:'Сапоги паломника',w:2,h:2,slots:['boots'],hp:5},
  garnet:{name:'Гранатовое кольцо',w:1,h:1,slots:['ring1','ring2'],hp:4,image:'item_ring1.png'},
  sapphire:{name:'Сапфировое кольцо',w:1,h:1,slots:['ring1','ring2'],mana:10,image:'item_ring2.png'},
  amulet:{name:'Знак переправы',w:1,h:2,slots:['amulet'],hp:8},
  shield:{name:'Щит паломника',w:2,h:3,slots:['leftHand'],hp:5,image:'item_leftHand.png'},
  roadArmor:{name:'Доспех дозорного',w:2,h:3,slots:['armor'],hp:16,image:'item_armor.png'},
 };
 const CATALOG=Object.freeze(Object.fromEntries(Object.entries(raw).map(([id,v])=>[id,Object.freeze({hp:0,mana:0,image:'item_'+id+'.png',...v,slots:Object.freeze(v.slots),id,provenance:v.gift?'gift-preview':'local-dev'})])));
 const clone=i=>JSON.parse(JSON.stringify(i));
 const item=(i,id)=>Object.hasOwn(i.items,id)?CATALOG[i.items[id]]:null;
 function fits(i,id,x,y){
  const d=item(i,id);if(!d||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+d.w>W||y+d.h>H)return false;
    return Object.entries(i.bag).every(([other,p])=>{if(other===id)return true;const q=item(i,other);return !!q&&!!p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&!(x<p.x+q.w&&p.x<x+d.w&&y<p.y+q.h&&p.y<y+d.h);});
 }
 function firstSpace(i,id){for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(fits(i,id,x,y))return{x,y};return null;}
 function location(i,id){if(!item(i,id))return null;for(const [slot,value]of Object.entries(i.slots))if(value===id)return{slot};return Object.hasOwn(i.bag,id)?i.bag[id]:null;}
 function valid(i){
  if(!i||i.version!==1||!i.items||!i.slots||!i.bag||!Number.isSafeInteger(i.revision)||i.revision<0)return false;
  if(Object.keys(i.slots).length!==11||Object.keys(i.slots).some(s=>!Object.hasOwn(SLOTS,s)))return false;
  const ids=Object.keys(i.items);if(ids.length>48||ids.some(id=>!/^[-a-z0-9]{1,40}$/.test(id)||!Object.hasOwn(CATALOG,i.items[id])))return false;
  const placed=[];for(const [slot,id]of Object.entries(i.slots))if(id!==null){if(!item(i,id)?.slots.includes(slot))return false;placed.push(id);}
  for(const [id,p]of Object.entries(i.bag)){if(!p||!fits(i,id,p.x,p.y))return false;placed.push(id);}
  return !!item(i,i.slots.rightHand)?.gift&&placed.length===ids.length&&new Set(placed).size===ids.length&&ids.every(id=>placed.includes(id));
 }
 function create(gift='sword'){
  const i={version:1,revision:0,items:{},slots:Object.fromEntries(Object.keys(SLOTS).map(s=>[s,null])),bag:{}};
  for(const [slot,def]of Object.entries({helm:'helm',armor:'armor',shoulders:'shoulders',belt:'belt',gloves:'gloves',boots:'boots',ring1:'garnet',ring2:'sapphire',amulet:'amulet',leftHand:'shield',rightHand:gift==='orb'?'orb':'sword'})){
   const id=def==='sword'||def==='orb'?def:'starter-'+slot.toLowerCase();i.items[id]=def;i.slots[slot]=id;
  }
  for(const [id,def]of [[gift==='orb'?'sword':'orb',gift==='orb'?'sword':'orb'],['spare-armor','roadArmor'],['spare-ring','garnet']]){i.items[id]=def;i.bag[id]=firstSpace(i,id);}
  return i;
 }
 function stats(i){let hp=50,mana=90;for(const id of Object.values(i.slots)){const d=item(i,id);hp+=d?.hp||0;mana+=d?.mana||0;}return{maxHp:hp,maxMana:mana,gift:item(i,i.slots.rightHand).gift};}
 function command(current,c){
  if(!valid(current)||!c)return{ok:false,reason:'invalid'};
  if(c.revision!==undefined&&c.revision!==current.revision)return{ok:false,reason:'stale'};
  const i=clone(current),d=item(i,c.id),loc=d&&location(i,c.id);
  if(c.kind==='pack'){
   // Deterministic first-fit decreasing. Bounded, no exponential search. A
   // packing failure keeps the ORIGINAL arrangement and every item intact.
   const ids=Object.keys(i.bag).sort((a,b)=>{const x=item(i,a),y=item(i,b);return y.w*y.h-x.w*x.h||y.h-x.h||(a<b?-1:a>b?1:0);});
   i.bag={};for(const id of ids){const p=firstSpace(i,id);if(!p)return{ok:false,reason:'space'};i.bag[id]=p;}
  }else if(!loc)return{ok:false,reason:'missing'};
  else if(c.kind==='equip'){
   if(!Object.hasOwn(SLOTS,c.slot)||!d.slots.includes(c.slot))return{ok:false,reason:'slot'};
   if(loc.slot===c.slot)return{ok:true,changed:false,inventory:current};
   const displaced=i.slots[c.slot];
   if(loc.slot)i.slots[loc.slot]=null;else delete i.bag[c.id];
   i.slots[c.slot]=c.id;
   if(displaced){
    const old=item(i,displaced);
    if(loc.slot&&old.slots.includes(loc.slot))i.slots[loc.slot]=displaced;
    else{const p=firstSpace(i,displaced);if(!p)return{ok:false,reason:'space'};i.bag[displaced]=p;}
   }
  }else if(c.kind==='move'||c.kind==='unequip'){
   if(loc.slot==='rightHand')return{ok:false,reason:'weapon'};
   if(loc.slot)i.slots[loc.slot]=null;else delete i.bag[c.id];
   const p=c.kind==='move'?{x:c.x,y:c.y}:firstSpace(i,c.id);
   if(!p||!fits(i,c.id,p.x,p.y))return{ok:false,reason:'space'};i.bag[c.id]=p;
  }else return{ok:false,reason:'command'};
  if(!valid(i))return{ok:false,reason:'invalid'};
  const changed=JSON.stringify(i.slots)!==JSON.stringify(current.slots)||JSON.stringify(Object.entries(i.bag).sort())!==JSON.stringify(Object.entries(current.bag).sort());
  if(!changed)return{ok:true,changed:false,inventory:current};
  i.revision++;return{ok:true,changed:true,inventory:i};
 }
 // Local shop transfers only ordinary items; grid placement stays here.
 function receive(current,definition,id){
  if(!valid(current)||!Object.hasOwn(CATALOG,definition)||CATALOG[definition].gift||typeof id!=='string'||!/^[-a-z0-9]{1,40}$/.test(id)||Object.hasOwn(current.items,id))return{ok:false,reason:'item'};
  if(Object.keys(current.items).length>=48)return{ok:false,reason:'space'};
  const i=clone(current);i.items[id]=definition;const p=firstSpace(i,id);if(!p)return{ok:false,reason:'space'};i.bag[id]=p;i.revision++;return{ok:true,changed:true,inventory:i};
 }
 function take(current,id){
  if(!valid(current))return{ok:false,reason:'invalid'};const d=item(current,id);
  if(!d)return{ok:false,reason:'missing'};if(d.gift)return{ok:false,reason:'gift'};
  if(!Object.hasOwn(current.bag,id))return{ok:false,reason:'equipped'};
  const i=clone(current);delete i.bag[id];delete i.items[id];i.revision++;return{ok:true,changed:true,inventory:i};
 }
 const api={W,H,SLOTS,CATALOG,item,location,fits,create,valid,stats,command,clone,receive,take};root.INVENTORY=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
