/* Presentation/transport for the existing 2D instance contract. No local SIM
 * advance, ownership proof, profile save or reward writes. The room admission
 * owner supplies the endpoint and a fresh one-use ticket privately per attempt.
 * No query-string credentials, automatic reconnect loop or default public host. */
(function(root){
 'use strict';
 const SIM=typeof require==='function'?require('./sim.js'):root.SIM;
 const contracts=typeof require==='function'?require('./profile-contracts.js'):root.GIFTBORNE_SERVER_CONTRACTS;
 const VERSION='giftborne.2d-instance.v1',STORY_VERSION='giftborne.2d-instance.v2',JOURNEY_VERSION='giftborne.2d-instance.v3',DUEL_VERSION='giftborne.2d-duel-instance.v1',MAX_BYTES=65536,TIMEOUT=10000;
 const copy=x=>JSON.parse(JSON.stringify(x)),object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
 const integer=(x,min=0)=>Number.isSafeInteger(x)&&x>=min&&x<Number.MAX_SAFE_INTEGER;
 const finite=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e12;
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
 const gift=x=>x==='sword'||x==='orb';
 const templates=Object.fromEntries(['boss','crypt','camp'].map(area=>[area,SIM.createParty({area,members:[{id:'player-1',gift:'sword'}]})]));
 function parse(raw){
  const fail=()=>{throw Error('party-frame');};
  if(typeof raw!=='string'||raw.length>MAX_BYTES||new TextEncoder().encode(raw).length>MAX_BYTES)fail();
  const v=JSON.parse(raw),duel=v?.version===DUEL_VERSION,journey=v?.version===JOURNEY_VERSION,story=journey||v?.version===STORY_VERSION,keys=['version','type','instanceId','area','t','steps','phase','cleared','kills','eventId','actionId','self','players','enemies','events',...(duel?['result']:[]),...(story?['story']:[]),...(journey?['journey']:[])];
  if(!exact(v,keys)||!duel&&!story&&v.version!==VERSION||v.type!=='snapshot'||!id(v.instanceId)||!(duel?['boss']:journey?['boss','crypt','camp']:['boss','crypt']).includes(v.area)||!(duel?['ready','playing','finished']:['playing','lost']).includes(v.phase)||typeof v.cleared!=='boolean'||!finite(v.t)||v.t<0||!['steps','kills','eventId','actionId'].every(k=>integer(v[k]))||Math.abs(v.t-v.steps*SIM.DT)>1e-6*Math.max(1,v.t)||!exact(v.self,['id','generation','sequence'])||!integer(v.self.generation,1)||!integer(v.self.sequence)||!Array.isArray(v.players)||v.players.length<1||v.players.length>5||!Array.isArray(v.enemies)||!Array.isArray(v.events)||v.events.length>64)fail();
  if(journey&&(!exact(v.journey,['stage'])||v.journey.stage!==({crypt:0,boss:1,camp:2})[v.area]||v.area==='camp'&&v.story===null))fail();
  if(story&&(!journey&&v.area!=='boss'||v.story!==null&&(!exact(v.story,['version','milestone'])||v.story.version!=='giftborne.2d-story.v1'||v.story.milestone!=='warden-defeated'||!['boss',...(journey?['camp']:[])].includes(v.area)||!v.cleared||v.phase==='lost')))fail();
  const template=templates[v.area],hero=template.members[0].state.hero;
  function actor(a,base,optional=[]){
   if(!object(a)||Object.keys(base).some(k=>!Object.hasOwn(a,k))||Object.keys(a).some(k=>!Object.hasOwn(base,k)&&!optional.includes(k)))fail();
   for(const k of Object.keys(base)){if(k==='action')continue;if(typeof a[k]!==typeof base[k]||typeof a[k]==='number'&&!finite(a[k]))fail();}
   if(!id(a.id)||!integer(a.maxHp,1)||a.maxHp>10000||a.hp<0||a.hp>a.maxHp||a.x<0||a.x>SIM.VIEW.W||a.y<0||a.y>SIM.VIEW.H||a.radius<=0||a.radius>100||![-1,1].includes(a.face))fail();
  }
  for(const p of v.players){
   if(!exact(p,['id','hero','gift','appearance','connected',...(duel?['ready']:[])])||!/^player-[1-5]$/.test(p.id)||!gift(p.gift)||typeof p.connected!=='boolean'||duel&&typeof p.ready!=='boolean'||!exact(p.appearance,['weapon','offHand'])||p.appearance.weapon!==p.gift||!['shield','seeing-red'].includes(p.appearance.offHand))fail();
   actor(p.hero,hero);const h=p.hero,a=h.action;
   if(h.id!==p.id||h.kind!=='player'||!integer(h.maxMana,1)||h.maxMana>10000||h.mana<0||h.mana>h.maxMana||!integer(h.potions)||h.potions>4)fail();
   if(a!==null&&(!exact(a,['kind','id','t','angle','gift','resolved'])||!['attack','skill'].includes(a.kind)||!integer(a.id,1)||a.id>v.actionId||!finite(a.t)||a.t<0||a.t>v.t||!finite(a.angle)||!gift(a.gift)||typeof a.resolved!=='boolean'))fail();
  }
  const ids=v.players.map(p=>p.id);
  if(new Set(ids).size!==ids.length||!v.players.some(p=>p.id===v.self.id&&p.connected))fail();
  if(v.enemies.length!==(duel?0:template.enemies.length))fail();
  for(let i=0;i<v.enemies.length;i++){
   const a=v.enemies[i],base=template.enemies[i];actor(a,base,['targetId']);
   if(a.id!==base.id||a.kind!==base.kind||!['idle','chase','windup','attack','recovery','dead'].includes(a.phase)||(a.hp===0)!==(a.phase==='dead')||Object.hasOwn(a,'targetId')&&!ids.includes(a.targetId))fail();
  }
  if(duel){
   const living=v.players.filter(p=>p.hero.hp>0),r=v.result;
   if(ids.slice().sort().join(',')!=='player-1,player-2'||v.cleared||v.kills!==0||v.steps>SIM.DUEL_RULES.durationTicks||v.phase==='ready'&&v.steps!==0)fail();
   if(v.phase==='finished'){
    if(!exact(r,['winnerId','reason','step'])||r.step!==v.steps||r.winnerId!==null&&!ids.includes(r.winnerId)||!['knockout','disconnect','timeout','cancelled'].includes(r.reason)||v.players.some(p=>p.hero.action!==null||p.hero.vx!==0||p.hero.vy!==0||p.hero.invulnerable))fail();
    if(r.reason==='cancelled'&&(v.steps!==0||v.actionId!==0||r.winnerId!==null||living.length!==2))fail();
    if(r.reason==='knockout'&&(living.length===2||r.winnerId!==(living[0]?.id||null))||r.reason==='timeout'&&(v.steps!==SIM.DUEL_RULES.durationTicks||r.winnerId!==null||living.length!==2)||r.reason==='disconnect'&&living.length!==2)fail();
   }else if(r!==null||living.length!==2||v.steps===SIM.DUEL_RULES.durationTicks)fail();
  }else if(v.cleared!==v.enemies.every(e=>e.hp===0)||v.kills!==v.enemies.filter(e=>e.hp===0).length||(v.phase==='lost')!==v.players.every(p=>p.hero.hp===0))fail();
  const extras={hit:[],kill:[],heal:['amount'],contact:['action','actionId','angle','reach','hits','gift'],evade:[],hurt:[],lose:[],telegraph:['angle','reach','arc','duration'],enemyAttack:['angle','reach'],attack:['angle','gift','actionId'],skill:['angle','gift','actionId'],potion:['amount'],dodge:['angle'],...(duel?{duelResult:['winnerId','reason']}:{} )};
  let last=0;
  for(const e of v.events){
   if(!object(e)||!Object.hasOwn(extras,e.k)||!exact(e,['id','k','t','x','y','damage','source','target',...extras[e.k]])||!integer(e.id,1)||e.id<=last||e.id>v.eventId||!finite(e.t)||e.t<0||e.t>v.t||!finite(e.x)||!finite(e.y)||!finite(e.damage)||e.damage<0||!id(e.source)||e.target!==null&&!id(e.target))fail();
   if(duel&&(!['contact','evade','hurt','lose','attack','skill','dodge','duelResult'].includes(e.k)||!ids.includes(e.source)||e.target!==null&&!ids.includes(e.target)))fail();
   for(const k of extras[e.k])if(k==='winnerId'?e[k]!==v.result?.winnerId:k==='reason'?e[k]!==v.result?.reason:k==='action'?!['attack','skill'].includes(e[k]):k==='gift'?!gift(e[k]):!finite(e[k]))fail();last=e.id;
  }
  return v;
 }
 const journeyPath=p=>p==='/v1/2d/journey/ws'||/^\/v1\/2d\/journey\/exp-[A-Za-z0-9_-]{16}\/ws$/.test(p);
 const duelPath=p=>p==='/v1/2d/duel/ws'||/^\/v1\/2d\/duel\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/ws$/.test(p);
 function endpoint(value){try{const u=new URL(value),publicContract=(['/v1/2d/ws','/v1/2d/story/ws'].includes(u.pathname)||journeyPath(u.pathname)||duelPath(u.pathname))&&u.search===contracts.gameClientUrl(u.pathname,u.origin).search;if(u.username||u.password||u.search&&!publicContract||u.hash||u.protocol!=='wss:'&&!(u.protocol==='ws:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error();return u.href;}catch{throw Error('party-endpoint');}}
 function create({state,url,issueTicket,WebSocketImpl=root.WebSocket,clock=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,onChange=()=>{},onSnapshot=()=>{}}){
  url=endpoint(url);if(!state?.campaign||typeof issueTicket!=='function')throw Error('party-client');
  const expectedVersion=duelPath(new URL(url).pathname)?DUEL_VERSION:journeyPath(new URL(url).pathname)?JOURNEY_VERSION:new URL(url).pathname==='/v1/2d/story/ws'?STORY_VERSION:VERSION,duel=expectedVersion===DUEL_VERSION;
  let status='idle',epoch=0,socket=null,deadline=null,watchdog=null,pending=null,settle=null,last=null,lastSeen=0,sequence=0,eventFloor=0,frames=0;
  const actors=new Map(),enemies=new Map();
  const snapshot=()=>({status,frames,instanceId:last?.instanceId??null,generation:last?.self.generation??null,sequence,steps:last?.steps??null,eventId:last?.eventId??null});
  const publish=s=>{status=s;onChange(s);};
  function stop(reason){
   ++epoch;clearTimer(deadline);clearTimer(watchdog);deadline=watchdog=null;
   const s=socket;socket=null;if(s){s.onopen=s.onmessage=s.onerror=s.onclose=null;try{s.close();}catch{}}
   const done=settle;settle=null;pending=null;state.paused=true;publish(reason);done?.(false);
  }
  function send(value){if(socket?.readyState!==1||socket.bufferedAmount>8192){stop('interrupted');return false;}try{socket.send(JSON.stringify(value));return true;}catch{stop('interrupted');return false;}}
  function armWatch(own){watchdog=setTimer(()=>{watchdog=null;if(own!==epoch)return;if(clock()-lastSeen>=TIMEOUT||!send({type:'heartbeat'})){if(own===epoch)stop('interrupted');return;}armWatch(own);},1000);}
  function receive(raw,first){
   const v=parse(raw);
   if(v.version!==expectedVersion||last?.story&&!v.story)throw Error('party-version');
   if(duel&&last&&(last.phase!=='ready'&&v.phase==='ready'||last.result&&JSON.stringify(last.result)!==JSON.stringify(v.result)))throw Error('duel-result');
   const areaChanged=!!last&&v.area!==last.area,forward=areaChanged&&expectedVersion===JOURNEY_VERSION&&v.journey.stage>last.journey.stage;
   if(last&&(v.instanceId!==last.instanceId||areaChanged&&!forward||v.self.id!==last.self.id||v.players.map(p=>p.id).join()!==last.players.map(p=>p.id).join()||v.steps<last.steps||v.eventId<last.eventId||v.actionId<last.actionId||!forward&&v.kills<last.kills||(first?v.self.generation<=last.self.generation:v.self.generation!==last.self.generation)))throw Error('party-order');
   if(!first&&(v.self.sequence>sequence||v.self.sequence<last.self.sequence))throw Error('party-sequence');
   if(first){sequence=v.self.sequence;eventFloor=v.eventId;state.ev=[];}
   if(areaChanged){enemies.clear();state.ev=[];}
   for(const p of v.players){if(!actors.has(p.id))actors.set(p.id,p.id===v.self.id?state.hero:{});Object.assign(actors.get(p.id),p.hero);}
   for(const e of v.enemies){if(!enemies.has(e.id))enemies.set(e.id,{});Object.assign(enemies.get(e.id),e);}
   const self=v.players.find(p=>p.id===v.self.id),events=v.events.filter(e=>e.id>eventFloor);eventFloor=v.eventId;
   Object.assign(state,{area:v.area,t:v.t,steps:v.steps,phase:duel?v.phase:v.story&&v.area!=='camp'?'won':self.hero.hp>0?'playing':'lost',duelMember:duel?self.id:null,duelResult:duel?v.result:null,duelReady:duel?self.ready:false,partyStory:v.story??null,partyJourney:v.journey??null,partyMember:self.id,gift:self.gift,partyAppearance:self.appearance,kills:v.kills,eventId:v.eventId,actionId:v.actionId,
    hero:actors.get(self.id),enemies:v.enemies.map(e=>enemies.get(e.id)),ev:[...state.ev,...events].slice(-64),partyPeers:v.players.filter(p=>p.id!==self.id).map(p=>({...p,hero:actors.get(p.id)}))});
   state.areaStates={camp:[],[v.area]:state.enemies};last=v;lastSeen=clock();frames++;onSnapshot({first,areaChanged,eventId:v.eventId});
  }
  function connect(){
   if(status==='disposed')return Promise.resolve(false);if(pending)return pending;if(status==='connected')return Promise.resolve(true);
   stop('connecting');const own=epoch;pending=new Promise(resolve=>{settle=resolve;});const result=pending;
   deadline=setTimer(()=>{if(own===epoch)stop('interrupted');},TIMEOUT);
   Promise.resolve().then(()=>issueTicket()).then(ticket=>{
    if(own!==epoch)return;if(typeof ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(ticket))throw Error('party-ticket');
    const s=socket=new WebSocketImpl(url);let first=true;
    s.onopen=()=>{if(own!==epoch)return;send({type:'authenticate',ticket});ticket=null;};
    s.onmessage=e=>{if(own!==epoch)return;try{receive(e.data,first);}catch{stop('invalid');return;}
     if(first){first=false;clearTimer(deadline);deadline=null;const done=settle;settle=null;pending=null;publish('connected');armWatch(own);done?.(true);}};
    s.onerror=s.onclose=()=>{if(own===epoch)stop('interrupted');};
   }).catch(()=>{if(own===epoch)stop('interrupted');});return result;
  }
  function input(value){
   const returning=last?.journey?.stage===1&&state.phase==='won'&&value.interact===true&&Object.keys(value).length===1;
   if(status!=='connected'||(state.hero.hp<=0||state.phase!=='playing')&&!returning)return false;
   const input={};for(const k of ['mx','my'])if(Object.hasOwn(value,k))input[k]=Number.isFinite(value[k])?Math.max(-1,Math.min(1,value[k])):0;
   for(const k of ['act','skill','dodge',...(!duel?['potion']:[]),...(last.journey?['interact']:[])])if(Object.hasOwn(value,k))input[k]=value[k]===true;
   if(Number.isFinite(value.aimX)&&Number.isFinite(value.aimY)){input.aimX=Math.max(0,Math.min(SIM.VIEW.W,value.aimX));input.aimY=Math.max(0,Math.min(SIM.VIEW.H,value.aimY));}
   if(!integer(sequence+1,1)){stop('interrupted');return false;}return send({generation:last.self.generation,sequence:++sequence,...(last.journey?{stage:last.journey.stage}:{}),input});
  }
  function ready(value){if(!duel||status!=='connected'||last?.phase!=='ready'||typeof value!=='boolean'||!integer(sequence+1,1))return false;return send({type:'ready',generation:last.self.generation,sequence:++sequence,ready:value});}
  return{connect,input,ready,snapshot,suspend(){if(!['disposed','interrupted','invalid'].includes(status))stop('interrupted');},dispose(){if(status!=='disposed')stop('disposed');}};
 }
 root.PARTY_CLIENT={VERSION,STORY_VERSION,JOURNEY_VERSION,DUEL_VERSION,parse,create};if(typeof module!=='undefined')module.exports=root.PARTY_CLIENT;
})(typeof window!=='undefined'?window:globalThis);
