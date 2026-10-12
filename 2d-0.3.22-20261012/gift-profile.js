/* Adapter to existing Giftborne auth, character and equipment owners.
 * No local-save import, ownership guesses, combat formulas or reward writes.
 * Credentials and original launch data remain private and memory-only. */
(function(root){
 'use strict';
 const MAX_AGE=60000,TOKEN=/^[A-Za-z0-9_-]{43}$/;
 const contracts=typeof require==='function'?require('./profile-contracts.js'):root.GIFTBORNE_SERVER_CONTRACTS;
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 const text=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[\x00-\x1f\x7f]/.test(v);
 const fail=()=>{throw Error('response-invalid');};
 function parseGift(v){
  if(!exact(v,['slug','collectionId','collectionName','number','model','symbol','backdrop'])||!text(v.slug)||! /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v.slug)||typeof v.collectionId!=='string'||!/^\d{1,32}$/.test(v.collectionId)||!text(v.collectionName)||!integer(v.number,1))return fail();
  const trait=t=>{if(!exact(t,['name','rarityPermille'])||!text(t.name)||!integer(t.rarityPermille,0,1000))return fail();return{name:t.name,rarityPermille:t.rarityPermille};};
  if(!exact(v.backdrop,['name','rarityPermille','colors'])||!exact(v.backdrop.colors,['center','edge','symbol','text'])||Object.values(v.backdrop.colors).some(c=>!integer(c,0,0xffffff)))return fail();
  return{slug:v.slug,collectionId:v.collectionId,collectionName:v.collectionName,number:v.number,model:trait(v.model),symbol:trait(v.symbol),backdrop:{...trait({name:v.backdrop.name,rarityPermille:v.backdrop.rarityPermille}),colors:{...v.backdrop.colors}}};
 }
 function parseInventory(v,now){
  if(!exact(v,['inventory','equipment'])||!exact(v.inventory,['source','observedAtMs','gifts'])||v.inventory.source!=='telegram-bot-api.getUserGifts'||!integer(v.inventory.observedAtMs)||!integer(now)||now<v.inventory.observedAtMs||now-v.inventory.observedAtMs>=MAX_AGE||!Array.isArray(v.inventory.gifts)||v.inventory.gifts.length>1000||!Array.isArray(v.equipment)||v.equipment.length>1000)return fail();
  const gifts=v.inventory.gifts.map(parseGift);if(new Set(gifts.map(g=>g.slug)).size!==gifts.length)return fail();
  // Equipment projections are deliberately NOT consumed by this read-only UI.
  return{observedAtMs:v.inventory.observedAtMs,gifts};
 }
 function config(value){
  if(!exact(value,['serverOrigin','releaseId'])||typeof value.serverOrigin!=='string'||typeof value.releaseId!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(value.releaseId))return null;
  try{const u=new URL(value.serverOrigin),local=['127.0.0.1','localhost','[::1]'].includes(u.hostname);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(u.protocol!=='https:'&&!(local&&u.protocol==='http:')))return null;return{origin:u.origin,releaseId:value.releaseId,local};}catch{return null;}
 }
 function create({configuration,readInitData,fetchImpl=root.fetch?.bind(root),now=Date.now,clock=()=>performance.now(),onChange=()=>{},timeoutMs=12000,setTimer=setTimeout,clearTimer=clearTimeout}){
  const cfg=config(configuration);let token=null,launch=null,authAttempted=false,sessionUntil=0,proofUntil=0,epoch=0,pending=null,pendingKind=null,controller=null,expiryTimer=null,disposed=false;
  let profileToken=null,profileUntil=0,activeId=null,writeStarted=false;
  let account={status:cfg?'idle':'disabled',roster:null,activeCharacterId:null,equipment:null};
  let state={status:cfg?'idle':'disabled',local:cfg?.local||false,gifts:[],observedAtMs:null};
  function publish(status,extra={}){if(disposed)return;state={status,local:cfg?.local||false,gifts:[],observedAtMs:null,...extra};onChange();}
  function publishAccount(status,extra={}){if(disposed)return;account={status,roster:null,activeCharacterId:null,equipment:null,...extra};onChange();}
  function invalidate(status='unknown'){epoch++;controller?.abort();controller=null;pending=pendingKind=null;clearTimer(expiryTimer);expiryTimer=null;proofUntil=0;if(writeStarted){profileToken=null;activeId=null;}writeStarted=false;account={status:cfg?status:'disabled',roster:null,activeCharacterId:null,equipment:null};publish(cfg?status:'disabled');}
  function snapshot(){
   if(state.status==='checked'&&(clock()>=proofUntil||now()<state.observedAtMs||now()-state.observedAtMs>=MAX_AGE))invalidate('stale');
   const result=JSON.parse(JSON.stringify({...state,account}));
   // Saved intent is not ownership. Never display a verified slot beyond the
   // fresh inventory observation, or if the current traits no longer agree.
   const eq=result.account.equipment;if(eq)for(const slot of [eq,eq.offHand,eq.mainHand])if(slot?.ownership==='verified'){
    const current=result.gifts.find(g=>g.slug===slot.selection.slug);
    if(result.status!=='checked'||!current||JSON.stringify(current)!==JSON.stringify(slot.selection)){slot.ownership=result.status==='checked'&&!current?'not-owned':'unknown';slot.projection=null;}
   }
   return result;
  }
  async function request(route,body,bearer,signal){
   const u=contracts.gameClientUrl(route,cfg.origin);
   const res=await fetchImpl(u.href,{method:body===undefined?'GET':'POST',headers:{accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'}),...(bearer?{authorization:'Bearer '+bearer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal});
   if(!res.ok){if(res.status===401||res.status===426||res.status===409&&route==='/v1/auth/telegram')throw Error('reopen');if(res.status===409)throw Error('conflict');if(res.status===429)throw Error('rate-limited');throw Error('unavailable');}
   const reader=res.body?.getReader();if(!reader)return fail();let size=0,value='';const decoder=new TextDecoder();
   try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>(route==='/v1/auth/telegram'?32768:1048576)){await reader.cancel().catch(()=>{});return fail();}value+=decoder.decode(part.value,{stream:true});}value+=decoder.decode();}finally{reader.releaseLock();}
   try{return JSON.parse(value);}catch{return fail();}
  }
  function takeSession(value,characterId){
   if(!exact(value,['socketTicket','expiresInSeconds','profileToken','profileExpiresInSeconds'])||!TOKEN.test(value.socketTicket)||!TOKEN.test(value.profileToken)||value.socketTicket===value.profileToken||value.expiresInSeconds!==60||value.profileExpiresInSeconds!==43200||!characterId)return fail();
   profileToken=value.profileToken;profileUntil=clock()+43200000;activeId=characterId;
   // Socket tickets are intentionally not retained until a 2D room reader exists.
  }
  async function authenticate(own,abort){
   const init=await readInitData();if(own!==epoch)return false;
   if(typeof init!=='string'||!init||new TextEncoder().encode(init).length>16384)throw Error('telegram-required');
   if(launch!==null&&init!==launch){token=profileToken=null;throw Error('reopen');}
   if(!token){if(authAttempted)throw Error('reopen');authAttempted=true;launch=init;
    const auth=await request('/v1/auth/telegram',{initData:init,releaseId:cfg.releaseId,characterSelection:true},null,abort.signal);if(own!==epoch)return false;
    if(!exact(auth,['mode','accountToken','accountExpiresInSeconds','roster','session'])||auth.mode!=='characters'||typeof auth.accountToken!=='string'||!TOKEN.test(auth.accountToken)||auth.accountExpiresInSeconds!==43200)return fail();
    const roster=contracts.parseCharacterRoster(auth.roster);if(auth.session===null){if(roster.selectedCharacterId!==null)return fail();}else takeSession(auth.session,roster.selectedCharacterId);
    token=auth.accountToken;sessionUntil=clock()+auth.accountExpiresInSeconds*1000;
   }
   if(clock()>=sessionUntil){token=profileToken=null;throw Error('reopen');}return true;
  }
  function operate(kind,run){
   if(disposed)return Promise.resolve(false);if(pending)return pendingKind===kind?pending:Promise.resolve(false);if(!cfg)return Promise.resolve(false);
   const own=++epoch;pendingKind=kind;writeStarted=false;
   const abort=new AbortController();controller=abort;
   let deadline;const expired=new Promise((_,reject)=>{deadline=setTimer(()=>{abort.abort();reject(Error('unavailable'));},timeoutMs);});
   const work=Promise.resolve().then(async()=>own===epoch&&await authenticate(own,abort)&&own===epoch?run(own,abort):false);
   const operation=Promise.race([work,expired]).catch(error=>{if(own!==epoch)return false;const wrote=writeStarted;epoch++;pending=pendingKind=null;controller=null;writeStarted=false;const message=error?.message==='gift-response-invalid'?'response-invalid':error?.message,safe=['reopen','host-unavailable','rate-limited','response-invalid','telegram-required','conflict'].includes(message)?message:'unavailable';if(safe==='reopen'||wrote){profileToken=null;activeId=null;}
    if(kind==='gifts')publish(safe);else publishAccount(wrote&&safe==='unavailable'?'unknown-result':safe);return false;
   }).finally(()=>{clearTimer(deadline);abort.abort();if(pending===operation){pending=pendingKind=null;controller=null;writeStarted=false;}});
   // Rendering may synchronously invalidate expired proof. Establish ownership
   // first, and never let this operation's cleanup erase a newer operation.
   pending=operation;
   if(kind==='gifts'){clearTimer(expiryTimer);proofUntil=0;publish('reading');}else publishAccount('reading');
   return operation;
  }
  function refresh(){return operate('gifts',async(own,abort)=>{
    const wire=await request('/v1/gifts/inventory',{initData:launch},token,abort.signal);if(own!==epoch)return false;
    const result=parseInventory(wire,now());proofUntil=clock()+MAX_AGE-(now()-result.observedAtMs);
    publish('checked',result);expiryTimer=setTimer(()=>{if(state.status==='checked')invalidate('stale');},Math.max(0,proofUntil-clock()));return true;
   });}
  async function readEquipment(own,abort,roster){
   let equipment=null;
   if(profileToken&&activeId&&clock()<profileUntil){const raw=await request('/v1/profile/gift-equipment',undefined,profileToken,abort.signal);if(own!==epoch)return false;equipment=contracts.parseClientCollectibleEquipment(raw);}
   else{profileToken=null;activeId=null;}
   publishAccount('ready',{roster,activeCharacterId:activeId,equipment});return true;
  }
  function refreshCharacters(){return operate('characters',async(own,abort)=>{
   const raw=await request('/v1/characters',undefined,token,abort.signal);if(own!==epoch)return false;
   if(!exact(raw,['roster','activeCharacterId'])||raw.activeCharacterId!==null)return fail();const roster=contracts.parseCharacterRoster(raw.roster);
   if(roster.selectedCharacterId!==activeId||!roster.characters.some(c=>c.characterId===activeId)){profileToken=null;activeId=null;}
   return readEquipment(own,abort,roster);
  });}
  function selectCharacter(id){
   const current=snapshot().account;if(current.status!=='ready'||!current.roster?.characters.some(c=>c.characterId===id)||pending)return Promise.resolve(false);
   const command={kind:'select',characterId:id,expectedRevision:current.roster.revision};
   return operate('select:'+id,async(own,abort)=>{
    profileToken=null;activeId=null;writeStarted=true;const raw=await request('/v1/characters/commands',command,token,abort.signal);if(own!==epoch)return false;
    if(!exact(raw,['roster','socketTicket','expiresInSeconds','profileToken','profileExpiresInSeconds']))return fail();const {roster:wire,...session}=raw,roster=contracts.parseCharacterRoster(wire);if(roster.selectedCharacterId!==id)return fail();takeSession(session,id);return readEquipment(own,abort,roster);
   });
  }
  function setEquipment(slot,slug){
   const view=snapshot(),current=view.account,key=slot==='main-hand'?'mainHand':slot==='off-hand'?'offHand':null;
   if(!key||pending||current.status!=='ready'||!current.equipment||!current.activeCharacterId||clock()>=profileUntil||slug!==null&&view.status!=='checked')return Promise.resolve(false);
   const gift=view.gifts.find(g=>g.slug===slug),supported=slot==='main-hand'?gift?.collectionName==='Light Sword'&&gift.model.name==='Absinthe':gift?.collectionName==='Crystal Ball'&&gift.model.name==='Seeing Red';
   if(slug!==null&&!supported)return Promise.resolve(false);if((current.equipment[key]?.selection?.slug??null)===slug)return Promise.resolve(true);
   const bytes=new Uint8Array(16);root.crypto.getRandomValues(bytes);const command={kind:'set-collectible-equipment',commandId:'2d-gift-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),expectedRevision:current.equipment.profileRevision,slot,giftSlug:slug},characterId=activeId;
   return operate('equip:'+slot,async(own,abort)=>{
    // Host reads may yield past the proof deadline. Removal needs no ownership
    // proof; equipping must still be checked at the actual write boundary.
    if(slug!==null&&(own!==epoch||snapshot().status!=='checked'||own!==epoch))return false;
    if(activeId!==characterId||!profileToken||clock()>=profileUntil)throw Error('reopen');
    writeStarted=true;const raw=await request('/v1/profile/commands',command,profileToken,abort.signal);if(own!==epoch)return false;
    // Never import the old campaign into this 2D save. Only the acknowledgement
    // revision is relevant; the slot is re-read through its canonical parser.
    if(!exact(raw,['replayed','profile'])||typeof raw.replayed!=='boolean'||!raw.profile||!integer(raw.profile.revision)||raw.profile.revision!==command.expectedRevision+1)return fail();
    const wire=await request('/v1/profile/gift-equipment',undefined,profileToken,abort.signal);if(own!==epoch)return false;const equipment=contracts.parseClientCollectibleEquipment(wire);
    if(equipment.profileRevision!==raw.profile.revision||(equipment[key]?.selection?.slug??null)!==slug)throw Error('conflict');
    publishAccount('ready',{roster:current.roster,activeCharacterId:characterId,equipment});return true;
   });
  }
  return{snapshot,refresh,refreshCharacters,selectCharacter,setEquipment,invalidate:()=>invalidate(),dispose(){invalidate();disposed=true;token=profileToken=launch=null;}};
 }
 // Official host SDK is loaded only for an explicitly configured profile path.
 // Failure cannot block the playable local episode; no token/login text field.
 let sdkPromise;
 function readTelegramInitData(){
  if(root.Telegram?.WebApp)return Promise.resolve(root.Telegram.WebApp.initData);
  if(!root.document)return Promise.resolve(undefined);
  return sdkPromise||=new Promise((resolve,reject)=>{
   const s=root.document.createElement('script');let ended=false;
   const finish=reason=>{if(ended)return;ended=true;clearTimeout(timer);s.onload=s.onerror=null;
    // A definite load error may retry manually. A timed-out script may still
    // execute later: retain its promise rather than initialize the host twice.
    if(reason==='host-unavailable'){s.remove();sdkPromise=null;}
    if(reason)reject(Error(reason));else resolve(root.Telegram.WebApp.initData);
   };
   const timer=setTimeout(()=>finish('reopen'),5000);
   s.src='https://telegram.org/js/telegram-web-app.js?64';s.referrerPolicy='no-referrer';
   s.onload=()=>finish(root.Telegram?.WebApp?null:'host-unavailable');s.onerror=()=>finish('host-unavailable');root.document.head.append(s);
  });
 }
 root.GIFT_PROFILE={MAX_AGE,parseGift,parseInventory,config,create,readTelegramInitData};if(typeof module!=='undefined')module.exports=root.GIFT_PROFILE;
})(typeof window!=='undefined'?window:globalThis);
