/* Giftborne 2D: deterministic, rendering-free SIM (UMD, fixed DT = 1/60).
 * create({gift:'sword'|'orb'}) -> ready state; start(S) -> playing; restart(gift)
 * returns a fresh PLAYING state. step(S,input) mutates and returns S. Paused,
 * ready and terminal states do not advance. No clock, random, DOM or network.
 * Feet coordinates use VIEW 1920x1080. face is +/-1; aim/attackAngle radians.
 * hero.*T are action START timestamps, not remaining durations. Enemy phaseT
 * is elapsed time within phase. dist is accumulated actual travel in pixels.
 * Input: mx,my axes; act/skill/dodge/interact booleans; optional aimX/aimY.
 * Movement and held actions repeat only when their recovery/cooldown permits.
 * Events: {id,k,t,x,y,damage,source,target,...}; last 64, authoritative contact.
 * Gift identity is a local playable preview, not Telegram ownership evidence.
 */
(function (root) {
  'use strict';
  const DT = 1 / 60;
  const VIEW = Object.freeze({ W: 1920, H: 1080 });
  const K = Object.freeze({
    walk: 265, heroRadius: 22, attackDuration: 0.48, attackContact: 0.19,
    attackCooldown: 0.56, skillDuration: 0.62, skillContact: 0.25,
    dodgeDuration: 0.25, dodgeSpeed: 760, invulnerability: 0.20,
    dodgeCooldown: 1.4, hurtInvulnerability: 0.34,
  });
  const GIFTS = Object.freeze({
    sword: Object.freeze({ id: 'sword', name: 'Световой меч', giftName: 'Light Sword',
      skillName: 'Серебряный полумесяц', description: 'Размашистый удар светом перед героем.',
      damage: 22, reach: 145, arc: 1.00, skillDamage: 42, skillReach: 235,
      skillArc: 1.35, skillCooldown: 5.5, color: '#81dff4', accent: '#f4da98' }),
    orb: Object.freeze({ id: 'orb', name: 'Хрустальный шар', giftName: 'Crystal Ball',
      skillName: 'Хрустальная волна', description: 'Круговая волна отталкивает врагов вокруг героя.',
      damage: 17, reach: 160, arc: 1.05, skillDamage: 34, skillReach: 235,
      skillArc: Math.PI, skillCooldown: 6.0, color: '#b59aff', accent: '#e1c6ff' }),
  });
  const LEVEL = Object.freeze({
    bounds: Object.freeze({ minX: 180, maxX: 1740, minY: 450, maxY: 930 }),
    spawn: Object.freeze({ x: 420, y: 760 }),
    shrine: Object.freeze({ x: 1550, y: 570, radius: 95 }),
    obstacles: Object.freeze([
      Object.freeze({ id: 'forge', x: 300, y: 510, r: 95 }),
      Object.freeze({ id: 'anvil', x: 535, y: 492, r: 52 }),
    ]),
  });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v) => Number.isFinite(v) ? v : 0;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const getGift = (id) => GIFTS[id] || GIFTS.sword;
  const TALENTS=Object.freeze({
    mastery:Object.freeze({name:'Мастерство',description:'Обычный удар +4 урона; сила Gift +6 урона.',damage:4,skillDamage:6}),
    fortitude:Object.freeze({name:'Стойкость',description:'Каждое полученное попадание наносит на 2 урона меньше, но не менее 1.',reduction:2}),
    will:Object.freeze({name:'Воля',description:'Сила экипированного Gift расходует на 5 маны меньше.',mana:5})
  });
  const emptyTalents=()=>({version:1,revision:0,picks:[]});
  // Ordinary, non-transferable local game gold. No Gift/market/TON pricing.
  const SHOP=Object.freeze({potion:Object.freeze({name:'Зелье здоровья',price:8,image:'supply_health.png',description:'В пояс: одно зелье. В бою восстанавливает до 55 здоровья.'}),helm:Object.freeze({name:'Шлем паломника',price:25,item:'helm'}),boots:Object.freeze({name:'Сапоги паломника',price:20,item:'boots'}),gloves:Object.freeze({name:'Рукавицы паломника',price:15,item:'gloves'}),roadArmor:Object.freeze({name:'Доспех дозорного',price:45,item:'roadArmor'})});
  const SALE=Object.freeze({helm:10,armor:8,shoulders:6,belt:4,gloves:6,boots:8,garnet:5,sapphire:5,amulet:12,shield:10,roadArmor:18});
  const emptyTrade=()=>({version:1,revision:0,serial:0,spent:0});
  const emptyExpedition=()=>({version:1,number:1,returned:false});
  const expeditionGold=()=>Object.values(campaign().ENEMIES).flat().reduce((n,e)=>n+(e[1]==='boss'?25:5),0);
  function tradeState(S){
    const dead=new Map(Object.values(S.areaStates||{}).flat().filter(e=>e.hp===0).map(e=>[e.id,e]));
    // Only an explicit descent retires a fully cleared/returned expedition.
    // Its ordinary gold remains earned when the current actor set is replaced.
    const banked=S.campaign?((S.expedition?.number||1)-1)*expeditionGold():0;
    const earned=banked+[...dead.values()].reduce((sum,e)=>sum+(e.kind==='boss'?25:5),0),initial=S.campaign?40:0;
    return{gold:initial+earned-(S.trade?.spent||0),earned,initial,revision:S.trade?.revision||0,inventoryRevision:S.inventory?.revision||0};
  }
  function talentState(S){
    const clear=!!S.campaign&&((S.expedition?.number||1)>1||S.areaStates.crypt?.length===campaign().ENEMIES.crypt.length&&S.areaStates.crypt.every(e=>e.hp===0));
    const earned=(clear?1:0)+(S.campaign&&S.completed?1:0),picks=S.talents?.picks||[];
    return{earned,available:Math.max(0,earned-picks.length),picks:[...picks],revision:S.talents?.revision||0,cryptClear:!!clear,returned:!!S.completed};
  }
  function getBuild(S,id=S.gift){
    const g=getGift(id),p=S.campaign?S.talents?.picks||[]:[],bound=combatBuilds.get(S),b=bound?.weapon===id?bound:null;
    return{...g,damage:(b?.damage??g.damage)+(p.includes('mastery')?TALENTS.mastery.damage:0),skillDamage:(b?.skillDamage??g.skillDamage)+(p.includes('mastery')?TALENTS.mastery.skillDamage:0),skillCooldown:b?.skillCooldown??g.skillCooldown,skillCost:S.campaign?25-(p.includes('will')?TALENTS.will.mana:0):0,damageReduction:(b?.damageReduction??0)+(p.includes('fortitude')?TALENTS.fortitude.reduction:0)};
  }
  const alive = (e) => e.hp > 0;
  const campaign = () => root.CAMPAIGN || (typeof require==='function'?require('./campaign.js'):null);
  const inventory = () => root.INVENTORY || (typeof require==='function'?require('./inventory.js'):null);
  const levelOf = S => S?.campaign ? campaign().AREAS[S.area] : LEVEL;

  // An in-memory combat input from the SERVER owner (or explicit QA), not an
  // ownership credential. Never read it from input intents or local saves.
  // Network clients must render server outcomes, not submit these values.
  const combatBuilds=new WeakMap();
  function bindCombatBuild(S,value){
    if(!S?.campaign)throw Error('combat-build-campaign');
    const keys=['version','weapon','offHand','damage','skillDamage','maxHp','maxMana','damageReduction','skillCooldown'];
    if(value!==null&&(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k))||value.version!=='giftborne.2d-combat-build.v1'||!Object.hasOwn(GIFTS,value.weapon)||!['shield','seeing-red'].includes(value.offHand)||
      ['damage','skillDamage','maxHp','maxMana','damageReduction'].some(k=>!Number.isSafeInteger(value[k])||value[k]<(['maxHp','maxMana'].includes(k)?1:0)||value[k]>10000)||!Number.isFinite(value.skillCooldown)||value.skillCooldown<=0||value.skillCooldown>60))throw Error('combat-build-invalid');
    const old=combatBuilds.get(S)||null;if(old===null&&value===null||old&&value&&keys.every(k=>old[k]===value[k]))return false;
    if(value===null)combatBuilds.delete(S);else combatBuilds.set(S,Object.freeze({...value}));
    const fallback=inventory().stats(S.inventory),h=S.hero;
    h.maxHp=value?.maxHp??fallback.maxHp;h.maxMana=value?.maxMana??fallback.maxMana;
    h.hp=Math.min(h.hp,h.maxHp);h.mana=Math.min(h.mana,h.maxMana);S.gift=value?.weapon??fallback.gift;
    // Revocation takes effect before contact, even if a skill was winding up.
    // Capacity changes never heal. Existing actor/run identity is preserved.
    h.action=null;h.vx=h.vy=0;S.inputLatch={};
    return true;
  }
  const equipmentAppearance=S=>({weapon:S.gift,offHand:combatBuilds.get(S)?.offHand||'shield'});

  function event(S, k, actor, extra) {
    S.ev.push(Object.assign({ id: ++S.eventId, k, t: S.t,
      x: actor.x, y: actor.y, damage: 0, source: actor.id || 'hero', target: null }, extra));
    if (S.ev.length > 64) S.ev.splice(0, S.ev.length - 64);
  }
  function makeEnemy(id, kind, x, y, hp, windup) {
    const boss = kind === 'boss';
    return { id, kind, x, y, hp, maxHp: hp, radius: boss ? 31 : 25,
      phase: 'idle', phaseT: 0, face: -1, aimAngle: Math.PI, attackAngle: Math.PI,
      vx: 0, vy: 0, dist: 0, hurtT: -99, deadT: -99, attackT: -99,
      attackId: 0, windup, reach: boss ? 155 : 112, arc: boss ? 1.05 : 0.94,
      speed: boss ? 98 : 116, damage: boss ? 19 : 11,
      recovery: boss ? 1.05 : 0.78, aggro: boss ? 500 : 550, engaged: false };
  }
  function create(options) {
    const gift = getGift(options && options.gift).id;
    const S = { t: 0, steps: 0, phase: 'ready', paused: false, gift, kills: 0,
      rewardClaimed: false, rewardReady: false, eventId: 0, actionId: 0, ev: [],
      hero: { id: 'hero', kind:'player', x: LEVEL.spawn.x, y: LEVEL.spawn.y, hp: 100, maxHp: 100,
        radius: K.heroRadius, vx: 0, vy: 0, face: 1, aimAngle: 0, dist: 0,
        attackT: -99, dodgeT: -99, hurtT: -99, skillT: -99, deadT: -99,
        attackAngle: 0, skillAngle: 0, dodgeAngle: 0,
        attackCooldown: 0, dodgeCooldown: 0, skillCooldown: 0,
        cooldown: 0, invulnerable: false, action: null },
      enemies: [makeEnemy('ash-1', 'raider', 1050, 710, 66, 0.78),
        makeEnemy('ash-2', 'raider', 1370, 620, 77, 0.9),
        makeEnemy('warden', 'boss', 1510, 790, 176, 1.03)] };
    if(options?.campaign){
      S.campaign=campaign().VERSION;S.area=null;S.areaStates={};S.completed=false;S.resultCount=0;S.inputLatch={};
      Object.assign(S.hero,{mana:100,maxMana:100,potions:4,potionCooldown:0});
      S.inventory=inventory().create(gift);S.talents=emptyTalents();S.trade=emptyTrade();S.expedition=emptyExpedition();
      enterArea(S,'camp',false);
    }
    return S;
  }
  function enterArea(S,id,announce=true){
    const C=campaign(),level=C.AREAS[id];if(!level)return false;
    if(S.enemies&&S.area)S.areaStates[S.area]=S.enemies;
    S.area=id;S.enemies=S.areaStates[id]||(C.ENEMIES[id].map(args=>{
      const e=makeEnemy(...args);e.aggro=e.kind==='boss'?380:300;e.speed=e.kind==='sentinel'?90:118;
      if(e.kind==='sentinel'){e.damage=16;e.reach=125;}return e;
    }));S.areaStates[id]=S.enemies;
    const h=S.hero;Object.assign(h,level.spawn,{vx:0,vy:0,action:null,invulnerable:false,dodgeT:-99});
    for(const e of S.enemies){e.vx=e.vy=0;if(e.hp>0){e.engaged=false;setPhase(e,'idle');}}
    if(announce)event(S,'area',h,{area:id});
    return true;
  }
  function interaction(S){
    if(!S.campaign||S.phase!=='playing')return null;
    const level=levelOf(S),h=S.hero;
    const door=level.doors.find(d=>distance(h,d)<=d.r);
    if(door)return {...door,name:doorName(S,door),kind:'door',locked:!!door.requiresClear&&S.enemies.some(alive)};
    const station=level.stations?.find(s=>distance(h,s)<115);
    return station?{...station,kind:'station'}:null;
  }
  function doorName(S,door){
    if(S.area==='camp'&&door.to==='crypt'&&S.expedition?.returned)return 'Новая вылазка в склеп';
    if(S.area==='boss'&&door.to==='camp'&&S.completed)return 'Вернуться в лагерь';
    return door.name;
  }
  function objective(S){
    if(S.area==='camp')return S.expedition?.returned?'Новая вылазка — за мостом':S.completed?'Продолжите вылазку за мостом':'Пройдите по мосту в склеп';
    if(S.enemies.some(alive))return S.area==='crypt'?'Одолейте стражей склепа':'Одолейте Хранителя';
    return S.area==='crypt'?'Путь к Хранителю открыт':S.completed?'Вернитесь в лагерь':'Верните печать в лагерь';
  }
  function interact(S){
    const i=interaction(S);if(!i||i.locked)return false;
    if(i.kind==='station'){Object.assign(S.hero,{action:null,vx:0,vy:0,dodgeT:-99,invulnerable:false});event(S,'station',S.hero,{station:i.id});return true;}
    if(S.area==='camp'&&i.to==='crypt'&&S.expedition.returned){
      if(S.expedition.number>=1000000)return false; // bounded local save counter
      S.expedition={version:1,number:S.expedition.number+1,returned:false};
      delete S.areaStates.crypt;delete S.areaStates.boss;S.kills=0;
      event(S,'expeditionStart',S.hero,{number:S.expedition.number,inert:true});
    }
    if(S.area==='boss'&&i.to==='camp'&&!S.expedition.returned){
      S.expedition.returned=true;event(S,'expeditionReturn',S.hero,{number:S.expedition.number,inert:true});
      if(!S.completed){S.completed=true;S.rewardClaimed=true;S.resultCount++;event(S,'episodeComplete',S.hero,{inert:true});}
    }
    enterArea(S,i.to);return true;
  }
  function snapshot(S){
    if(!S.campaign||S.partyMember)return null;
    // Existing saves migrate forward. Expedition history is optional/versioned;
    // older builds cannot preserve a later expedition (back up before rollback).
    return {version:1,expedition:{...S.expedition},inventory:inventory().clone(S.inventory),talents:{...S.talents,picks:[...S.talents.picks]},trade:{...S.trade},area:S.area,gift:S.gift,completed:S.completed,resultCount:S.resultCount,kills:S.kills,
      hp:S.hero.hp,mana:S.hero.mana,potions:S.hero.potions,position:[S.hero.x,S.hero.y],
      enemies:Object.fromEntries(Object.entries(S.areaStates).map(([area,es])=>[area,es.map(e=>({id:e.id,hp:e.hp,x:e.x,y:e.y}))]))};
  }
  function restore(data){
    const S=create({campaign:true,gift:data?.gift});if(!data||![1,2].includes(data.version))return S;
    if(data.inventory!==undefined||data.version===2){
      if(inventory().valid(data.inventory))S.inventory=inventory().clone(data.inventory);
      else S.inventoryRecovered=true;
    }
    const stats=inventory().stats(S.inventory);S.gift=stats.gift;S.hero.maxHp=stats.maxHp;S.hero.maxMana=stats.maxMana;
    const C=campaign();
    for(const id of Object.keys(C.AREAS)){
      enterArea(S,id,false);const saved=Array.isArray(data.enemies?.[id])?data.enemies[id]:[];
      for(const e of S.enemies){const v=saved.find(x=>x.id===e.id);if(!v)continue;
        e.hp=clamp(finite(v.hp),0,e.maxHp);if(C.walkable(C.AREAS[id],v.x,v.y,e.radius)){e.x=v.x;e.y=v.y;}
        if(e.hp===0){e.phase='dead';e.deadT=-99;}
      }
    }
    const defeated=S.areaStates.boss?.every(e=>e.hp===0),cleared=S.areaStates.crypt?.every(e=>e.hp===0),x=data.expedition;
    if(x!==undefined){
      if(x?.version===1&&Number.isSafeInteger(x.number)&&x.number>=1&&x.number<=1000000&&typeof x.returned==='boolean'&&
        (x.number===1||data.completed===true)&&(x.returned===false||!!defeated&&!!cleared&&data.completed===true))S.expedition={version:1,number:x.number,returned:x.returned};
      else S.expeditionRecovered=true;
    }else S.expedition.returned=!!data.completed&&!!defeated&&!!cleared;
    S.completed=!!data.completed&&(!!defeated||S.expedition.number>1);S.resultCount=S.completed?1:0;S.rewardClaimed=S.completed;
    S.kills=Object.values(S.areaStates).flat().filter(e=>e.hp===0).length;
    if(data.trade!==undefined){const t=data.trade,total=tradeState(S).gold;
      if(t?.version===1&&['revision','serial','spent'].every(k=>Number.isSafeInteger(t[k]))&&t.revision>=0&&t.serial>=0&&t.serial<=1000000&&t.spent>=-1000000&&t.spent<=total)S.trade={version:1,revision:t.revision,serial:t.serial,spent:t.spent};
      else{S.trade.spent=total;S.tradeRecovered=true;}
    }
    const t=data.talents;
    if(t!==undefined){
      if(t&&t.version===1&&Number.isSafeInteger(t.revision)&&t.revision>=0&&Array.isArray(t.picks)&&t.picks.length<=talentState(S).earned&&new Set(t.picks).size===t.picks.length&&t.picks.every(id=>Object.hasOwn(TALENTS,id)))S.talents={version:1,revision:t.revision,picks:[...t.picks]};
      else S.talentsRecovered=true;
    }
    const dead=!(data.hp>0);enterArea(S,dead?'camp':C.AREAS[data.area]?data.area:'camp',false);
    S.hero.hp=dead?S.hero.maxHp:clamp(data.hp,1,S.hero.maxHp);S.hero.mana=clamp(finite(data.mana),0,S.hero.maxMana);S.hero.potions=clamp(Math.floor(finite(data.potions)),0,4);
    if(!dead&&Array.isArray(data.position)&&C.walkable(levelOf(S),...data.position,S.hero.radius))Object.assign(S.hero,{x:data.position[0],y:data.position[1]});
    return S;
  }
  function start(S) {
    if (S.phase === 'ready') { S.phase = 'playing'; event(S, 'start', S.hero); }
    return S;
  }
  const restart = (gift) => start(create({ gift }));
  // Death returns the existing hero to the same camp. It is not a new episode:
  // killed actors, ordinary purchases, talent choices and results stay owned here.
  function recover(S){
    if(!S.campaign||S.partyMember||S.phase!=='lost')return false;
    enterArea(S,'camp');S.phase='playing';S.paused=false;S.inputLatch={};
    const h=S.hero;Object.assign(h,{hp:h.maxHp,deadT:-99,hurtT:-99,attackT:-99,skillT:-99,
      attackCooldown:0,dodgeCooldown:0,skillCooldown:0,potionCooldown:0,cooldown:0});
    event(S,'recover',h,{area:'camp',inert:true});return true;
  }
  function equipmentQuiet(S){return ['ready','playing'].includes(S.phase)&&S.hero.hp>0&&!S.hero.action&&S.t-S.hero.dodgeT>=K.dodgeDuration&&
    S.enemies.every(e=>!alive(e)||(!e.engaged&&distance(e,S.hero)>e.aggro));}
  function talentCommand(S,c){
    if(S.partyMember)return{ok:false,reason:'party'};
    if(!S.campaign)return{ok:false,reason:'campaign'};
    if(!equipmentQuiet(S))return{ok:false,reason:'combat'};
    if(!c||!['learn','reset'].includes(c.kind))return{ok:false,reason:'invalid'};
    const t=S.talents;if(c.revision!==undefined&&c.revision!==t.revision)return{ok:false,reason:'stale'};
    if(c.kind==='reset'){
      if(S.area!=='camp')return{ok:false,reason:'camp'};
      if(!t.picks.length)return{ok:true,changed:false};
      t.picks=[];
    }else{
      if(!Object.hasOwn(TALENTS,c.id))return{ok:false,reason:'invalid'};
      if(t.picks.includes(c.id))return{ok:true,changed:false};
      if(talentState(S).available<1)return{ok:false,reason:'points'};
      t.picks.push(c.id);
    }
    t.revision++;event(S,'talent',S.hero,{command:c.kind,talent:c.id||null,revision:t.revision,inert:true});return{ok:true,changed:true};
  }
  function inventoryCommand(S,command){
    if(S.partyMember)return{ok:false,reason:'party'};
    if(!S.campaign)return{ok:false,reason:'campaign'};
    if(combatBuilds.has(S))return{ok:false,reason:'server'};
    if(!equipmentQuiet(S))return{ok:false,reason:'combat'};
    const r=inventory().command(S.inventory,command);if(!r.ok||!r.changed)return r;
    S.inventory=r.inventory;const stats=inventory().stats(S.inventory);
    // Increasing capacity never heals/refills. Removing capacity can clamp;
    // re-equipping cannot restore the clamped resource or create a free heal.
    S.hero.maxHp=stats.maxHp;S.hero.maxMana=stats.maxMana;S.hero.hp=Math.min(S.hero.hp,stats.maxHp);S.hero.mana=Math.min(S.hero.mana,stats.maxMana);S.gift=stats.gift;
    event(S,'equipment',S.hero,{revision:S.inventory.revision,command:command.kind,item:command.id||null,gift:S.gift});return r;
  }
  function tradeCommand(S,c){
    if(S.partyMember)return{ok:false,reason:'party'};
    if(!S.campaign||S.phase!=='playing'||S.hero.hp<=0)return{ok:false,reason:'state'};
    if(S.area!=='camp'||interaction(S)?.id!=='merchant')return{ok:false,reason:'location'};
    if(!equipmentQuiet(S))return{ok:false,reason:'combat'};
    if(!c||!['buy','sell','rest'].includes(c.kind)||(c.quantity!==undefined&&c.quantity!==1))return{ok:false,reason:'command'};
    if((c.revision!==undefined&&c.revision!==S.trade.revision)||(c.inventoryRevision!==undefined&&c.inventoryRevision!==S.inventory.revision))return{ok:false,reason:'stale'};
    const h=S.hero;
    if(c.kind==='rest'){
      if(h.hp===h.maxHp&&h.mana===h.maxMana)return{ok:true,changed:false};
      const hp=h.maxHp-h.hp,mana=h.maxMana-h.mana;h.hp=h.maxHp;h.mana=h.maxMana;S.trade.revision++;event(S,'resupply',h,{hp,mana,potions:0,inert:true});return{ok:true,changed:true};
    }
    let price=0,nextInventory=S.inventory,nextSerial=S.trade.serial;
    if(c.kind==='buy'){
      if(!Object.hasOwn(SHOP,c.id))return{ok:false,reason:'stock'};const stock=SHOP[c.id];price=stock.price;
      if(c.id==='potion'&&h.potions>=4)return{ok:false,reason:'full'};
      if(tradeState(S).gold<price)return{ok:false,reason:'gold'};
      if(stock.item){let id;do{id='merchant-'+(++nextSerial);}while(Object.hasOwn(S.inventory.items,id));if(nextSerial>1000000)return{ok:false,reason:'space'};const r=inventory().receive(S.inventory,stock.item,id);if(!r.ok)return r;nextInventory=r.inventory;}
    }else{
      const d=inventory().item(S.inventory,c.id);if(!d)return{ok:false,reason:'missing'};
      if(d.gift)return{ok:false,reason:'gift'};if(!Object.hasOwn(SALE,d.id))return{ok:false,reason:'stock'};
      const r=inventory().take(S.inventory,c.id);if(!r.ok)return r;nextInventory=r.inventory;price=-SALE[d.id];
    }
    // Commit only after every balance/placement check. No partial charge.
    S.inventory=nextInventory;S.trade.spent+=price;S.trade.serial=nextSerial;S.trade.revision++;if(c.kind==='buy'&&c.id==='potion')h.potions++;
    event(S,'trade',h,{command:c.kind,item:c.id,goldDelta:-price,inert:true});return{ok:true,changed:true,goldDelta:-price};
  }
  function equip(S, id) {
    if (!GIFTS[id]) return false;
    if(S.campaign)return inventoryCommand(S,{kind:'equip',id,slot:'rightHand'}).ok;
    const quiet = S.phase !== 'playing' || (!S.hero.action &&
      S.enemies.every(e => !alive(e) || (!e.engaged && distance(e, S.hero) > e.aggro)));
    if (!quiet) return false;
    S.gift = id;
    event(S, 'equip', S.hero, { gift: id });
    return true;
  }

  function blocked(x, y, radius,level=LEVEL) {
    return (level.walkable&&!campaign().walkable(level,x,y,radius))||level.obstacles.some(o => Math.hypot(x - o.x, y - o.y) < o.r + radius - 0.01);
  }
  // Bounded substeps prevent a fast dodge crossing the forge. Resolve X then Y
  // for predictable wall sliding; actors share the same collision geometry.
  function move(actor, dx, dy,level=LEVEL) {
    const b = level.bounds, r = actor.radius, ox = actor.x, oy = actor.y;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let i = 0; i < n; i++) {
      const nx = clamp(actor.x + dx / n, b.minX + r, b.maxX - r);
      if (!blocked(nx, actor.y, r,level)) actor.x = nx;
      const ny = clamp(actor.y + dy / n, b.minY + r, b.maxY - r);
      if (!blocked(actor.x, ny, r,level)) actor.y = ny;
    }
    actor.vx = (actor.x - ox) / DT;
    actor.vy = (actor.y - oy) / DT;
    actor.dist += Math.hypot(actor.x - ox, actor.y - oy);
  }
  function clearLine(a, b,level=LEVEL) {
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    if(level.walkable){const n=Math.ceil(Math.sqrt(length2)/12);for(let i=0;i<=n;i++)if(!campaign().walkable(level,a.x+dx*i/Math.max(1,n),a.y+dy*i/Math.max(1,n)))return false;}
    return !level.obstacles.some(o => {
      const u = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / (length2 || 1), 0, 1);
      return Math.hypot(a.x + dx * u - o.x, a.y + dy * u - o.y) < o.r;
    });
  }
  function inContact(from, to, angle, reach, arc,level=LEVEL) {
    return distance(from, to) <= reach &&
      Math.abs(angleDiff(Math.atan2(to.y - from.y, to.x - from.x), angle)) <= arc &&
      clearLine(from, to,level);
  }
  function setPhase(e, phase) { e.phase = phase; e.phaseT = 0; }
  function damageEnemy(S, e, damage, source, push) {
    if (!alive(e)) return;
    const actual = Math.min(e.hp, damage);
    e.hp -= actual; e.hurtT = S.t; e.engaged = true;
    event(S, 'hit', e, { damage: actual, source, target: e.id });
    if (e.hp <= 0) {
      setPhase(e, 'dead'); e.deadT = S.t; e.vx = e.vy = 0; S.kills++;
      event(S, 'kill', e, { source, target: e.id });
      const heal = S.campaign?0:Math.min(S.hero.maxHp - S.hero.hp, e.kind === 'boss' ? 12 : 7);
      if (heal > 0) { S.hero.hp += heal; event(S, 'heal', S.hero, { amount: heal }); }
    } else if (push) {
      const a = Math.atan2(e.y - S.hero.y, e.x - S.hero.x);
      move(e, Math.cos(a) * push, Math.sin(a) * push,levelOf(S));
      // The radial gift buys space, but does not grant a permanent stunlock.
      if (e.kind !== 'boss') setPhase(e, 'recovery');
    }
  }
  function resolveHeroAction(S, action) {
    const h = S.hero, gift = getBuild(S,action.gift), skill = action.kind === 'skill';
    const reach = skill ? gift.skillReach : gift.reach;
    const arc = skill ? gift.skillArc : gift.arc;
    const damage = skill ? gift.skillDamage : gift.damage;
    let hits = 0;
    for (const e of S.enemies) if (alive(e) && inContact(h, e, action.angle, reach, arc,levelOf(S))) {
      damageEnemy(S, e, damage, h.id, skill && gift.id === 'orb' ? 70 : 0); hits++;
    }
    event(S, 'contact', h, { source: h.id, action: action.kind, actionId: action.id,
      angle: action.angle, reach, hits, gift: action.gift });
  }
  function damageHero(S, e) {
    const h = S.hero;
    if(!alive(h))return;
    if (h.invulnerable || S.t - h.hurtT < K.hurtInvulnerability) {
      event(S, 'evade', h, { source: e.id, target: h.id }); return;
    }
    const actual = Math.min(h.hp, Math.max(1,e.damage-getBuild(S).damageReduction));
    h.hp -= actual; h.hurtT = S.t;
    event(S, 'hurt', h, { source: e.id, target: h.id, damage: actual });
    if (h.hp <= 0) { S.phase = 'lost'; h.deadT=S.t; h.action = null; h.vx = h.vy = 0; event(S, 'lose', h); }
  }
  function chase(S, e) {
    const h = S.hero, a = Math.atan2(h.y - e.y, h.x - e.x);
    let angle = a;
    // Tangent steering only when an obstacle lies ahead. This is navigation,
    // not teleportation, and also permits pursuit around the forge's edge.
    for (const o of levelOf(S).obstacles) {
      const probe = { x: e.x + Math.cos(angle) * 55, y: e.y + Math.sin(angle) * 55 };
      if (Math.hypot(probe.x - o.x, probe.y - o.y) < o.r + e.radius + 4) {
        const radial = Math.atan2(e.y - o.y, e.x - o.x);
        const c1 = radial + Math.PI / 2, c2 = radial - Math.PI / 2;
        angle = Math.cos(c1 - a) >= Math.cos(c2 - a) ? c1 : c2;
      }
    }
    let dx=Math.cos(angle)*e.speed*DT,dy=Math.sin(angle)*e.speed*DT;
    if(S.campaign)for(const other of S.enemies){if(other===e||!alive(other))continue;const d=distance(e,other),min=e.radius+other.radius+9;if(d<min&&d>.01){dx+=(e.x-other.x)/d*(min-d)*4*DT;dy+=(e.y-other.y)/d*(min-d)*4*DT;}}
    move(e, dx, dy,levelOf(S));
    e.aimAngle = a; e.face = Math.cos(a) < 0 ? -1 : 1;
  }
  function stepEnemy(S, e) {
    if (!alive(e) || S.phase !== 'playing') return;
    const h = S.hero;
    e.vx = e.vy = 0; e.phaseT += DT;
    if (!e.engaged && distance(e, h) < e.aggro) e.engaged = true;
    if (!e.engaged) return;
    if (e.phase === 'idle') setPhase(e, 'chase');
    if (e.phase === 'chase') {
      if (distance(e, h) <= e.reach * 0.9 && clearLine(e, h,levelOf(S))) {
        e.attackAngle = Math.atan2(h.y - e.y, h.x - e.x);
        e.aimAngle = e.attackAngle; e.face = Math.cos(e.attackAngle) < 0 ? -1 : 1;
        setPhase(e, 'windup');
        event(S, 'telegraph', e, { angle: e.attackAngle, reach: e.reach, arc: e.arc,
          duration: e.windup, target: h.id });
      } else chase(S, e);
    } else if (e.phase === 'windup' && e.phaseT + 1e-9 >= e.windup) {
      setPhase(e, 'attack'); e.attackT = S.t; e.attackId++;
      event(S, 'enemyAttack', e, { angle: e.attackAngle, reach: e.reach, target: h.id });
      if (inContact(e, h, e.attackAngle, e.reach, e.arc,levelOf(S))) damageHero(S, e);
    } else if (e.phase === 'attack' && e.phaseT >= 0.18) setPhase(e, 'recovery');
    else if (e.phase === 'recovery' && e.phaseT >= e.recovery) setPhase(e, 'chase');
  }
  function beginAction(S, kind) {
    const h = S.hero, gift = getBuild(S);
    const action = { kind, id: ++S.actionId, t: S.t, angle: h.aimAngle, gift: gift.id, resolved: false };
    h.action = action;
    if (kind === 'attack') {
      h.attackT = S.t; h.attackAngle = action.angle; h.attackCooldown = K.attackCooldown;
    } else {
      if(S.campaign)h.mana-=gift.skillCost;
      h.skillT = S.t; h.skillAngle = action.angle; h.skillCooldown = gift.skillCooldown;
    }
    event(S, kind, h, { angle: action.angle, gift: gift.id, actionId: action.id });
  }
  function stepHero(S, inp) {
    const h = S.hero;
    h.vx = h.vy = 0;
    if(S.campaign){
      h.mana=Math.min(h.maxMana,h.mana+DT*3);h.potionCooldown=Math.max(0,h.potionCooldown-DT);
      if(inp.resupply)tradeCommand(S,{kind:'rest'});
      if(inp.potion&&!S.inputLatch.potion&&h.potions>0&&h.hp<h.maxHp&&h.potionCooldown===0){const amount=Math.min(55,h.maxHp-h.hp);h.hp+=amount;h.potions--;h.potionCooldown=3;event(S,'potion',h,{amount});}
      if(inp.interact&&!S.inputLatch.interact&&interact(S)){S.inputLatch={interact:true,potion:!!inp.potion};return false;}
      S.inputLatch={interact:!!inp.interact,potion:!!inp.potion};
    }
    for (const name of ['attackCooldown', 'skillCooldown', 'dodgeCooldown']) h[name] = Math.max(0, h[name] - DT);
    let mx = finite(inp.mx), my = finite(inp.my);
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    if (Number.isFinite(inp.aimX) && Number.isFinite(inp.aimY) &&
      Math.hypot(inp.aimX - h.x, inp.aimY - h.y) > 1) {
      h.aimAngle = Math.atan2(inp.aimY - h.y, inp.aimX - h.x);
    } else if (m > 0.05) h.aimAngle = Math.atan2(my, mx);
    if (!h.action) h.face = Math.cos(h.aimAngle) < 0 ? -1 : 1;
    if (inp.dodge && h.dodgeCooldown <= 0) {
      h.dodgeT = S.t; h.dodgeCooldown = K.dodgeCooldown;
      h.dodgeAngle = m > 0.05 ? Math.atan2(my, mx) : h.aimAngle;
      h.action = null;
      event(S, 'dodge', h, { angle: h.dodgeAngle });
    }
    const dodging = S.t - h.dodgeT < K.dodgeDuration;
    h.invulnerable = S.t - h.dodgeT < K.invulnerability;
    if (!dodging && !h.action) {
      if (inp.skill && h.skillCooldown <= 0 && (!S.campaign||h.mana>=getBuild(S).skillCost)) beginAction(S, 'skill');
      else if (inp.act && h.attackCooldown <= 0) beginAction(S, 'attack');
    }
    if (dodging) move(h, Math.cos(h.dodgeAngle) * K.dodgeSpeed * DT, Math.sin(h.dodgeAngle) * K.dodgeSpeed * DT,levelOf(S));
    else {
      const speed = K.walk * (h.action ? 0.42 : 1);
      move(h, mx * speed * DT, my * speed * DT,levelOf(S));
    }
    if (h.action) {
      const action = h.action, age = S.t - action.t;
      const contact = action.kind === 'skill' ? K.skillContact : K.attackContact;
      const duration = action.kind === 'skill' ? K.skillDuration : K.attackDuration;
      if (!action.resolved && age + 1e-9 >= contact) {
        action.resolved = true; resolveHeroAction(S, action);
      }
      if (age + 1e-9 >= duration) h.action = null;
    }
    h.cooldown = h.attackCooldown;
    return true;
  }
  function step(S, input) {
    if(S.partyMember)throw Error('party-step-owner');
    const inp = input || {};
    if (S.phase !== 'playing' || S.paused || inp.paused) return S;
    S.t += DT; S.steps++;
    if(!stepHero(S,inp))return S;
    const h=S.hero;
    for (const e of S.enemies) stepEnemy(S, e);
    if (!S.campaign && S.phase === 'playing' && S.enemies.every(e => !alive(e))) {
      if (!S.rewardReady) { S.rewardReady = true; event(S, 'readyReward', LEVEL.shrine); }
      if (distance(h, LEVEL.shrine) <= LEVEL.shrine.radius) {
        S.rewardClaimed = true; S.phase = 'won'; h.action = null; h.vx = h.vy = 0;
        event(S, 'win', LEVEL.shrine, { target: 'hero', gift: S.gift });
      }
    }
    return S;
  }
  // Shared 2D episode simulation, not a second auth, socket or persistence owner.
  // Only the server's bound roster may create members/submit their intents.
  // One authored area per run here; story completion/transport remain separate.
  const PARTY_VERSION='giftborne.2d-party.v1',PARTY_INPUT_TTL=15;
  function createParty({area='crypt',members}={}){
    if(!['crypt','boss'].includes(area)||!Array.isArray(members)||members.length<1||members.length>5||new Set(members.map(m=>m?.id)).size!==members.length||members.some(m=>!m||Object.keys(m).sort().join(',')!=='gift,id'||typeof m.id!=='string'||typeof m.gift!=='string'||!/^player-[1-5]$/.test(m.id)||!Object.hasOwn(GIFTS,m.gift)))throw Error('party-roster');
    const p={version:PARTY_VERSION,area,t:0,steps:0,phase:'playing',cleared:false,eventId:0,actionId:0,kills:0,ev:[],enemies:null,members:[]};
    // Keep the five authored arrival slots on the walkway, clear of the
    // entrance plinth and each other. The solo entry stays unchanged.
    const offsets=area==='crypt'?[[0,0],[-40,-35],[0,-90],[30,-130],[80,-145]]:[[0,0],[65,-25],[80,45],[130,0],[150,65]];
    for(const [i,member] of members.entries()){
      const s=create({campaign:true,gift:member.gift});enterArea(s,area,false);s.hero.id=member.id;s.partyMember=member.id;s.phase='playing';
      const level=levelOf(s),x=s.hero.x+offsets[i][0],y=s.hero.y+offsets[i][1];if(!campaign().walkable(level,x,y,s.hero.radius))throw Error('party-spawn');Object.assign(s.hero,{x,y});
      if(!p.enemies)p.enemies=s.enemies;else{s.enemies=p.enemies;s.areaStates=p.members[0].state.areaStates;}
      s.ev=p.ev;p.members.push({id:member.id,state:s,connected:true,generation:1,sequence:0,input:{},queued:{},inputTick:-PARTY_INPUT_TTL});
    }
    return p;
  }
  function clearPartyInput(m){m.input={};m.queued={};const h=m.state.hero;h.vx=h.vy=0;h.action=null;h.dodgeT=-99;h.invulnerable=false;m.state.inputLatch={};}
  function partyConnection(p,id,connected){
    const m=p.members.find(m=>m.id===id);if(!m||typeof connected!=='boolean')return false;if(m.connected===connected)return true;
    m.connected=connected;if(!connected){m.generation++;m.sequence=0;}clearPartyInput(m);return true;
  }
  function partyInput(p,id,packet){
    const m=p.members.find(m=>m.id===id),i=packet?.input,axes=['mx','my'],aim=['aimX','aimY'],actions=['act','skill','dodge','potion'];
    if(!m?.connected||m.state.hero.hp<=0||p.phase!=='playing'||!packet||Object.keys(packet).sort().join(',')!=='generation,input,sequence'||packet.generation!==m.generation||!Number.isSafeInteger(packet.sequence)||packet.sequence!==m.sequence+1||!i||typeof i!=='object'||Array.isArray(i)||Object.keys(i).some(k=>![...axes,...aim,...actions].includes(k))||axes.some(k=>k in i&&(!Number.isFinite(i[k])||Math.abs(i[k])>1))||actions.some(k=>k in i&&typeof i[k]!=='boolean')||aim.some(k=>k in i&&(!Number.isFinite(i[k])||i[k]<0||i[k]>(k==='aimX'?VIEW.W:VIEW.H)))||('aimX' in i)!==('aimY' in i))return false;
    for(const key of actions)if(i[key]&&!m.input[key])m.queued[key]=true;
    m.input={...i};m.sequence=packet.sequence;m.inputTick=p.steps;return true;
  }
  function partyContext(p,m,fn){
    const s=m.state;Object.assign(s,{t:p.t,steps:p.steps,eventId:p.eventId,actionId:p.actionId,kills:p.kills,ev:p.ev});
    fn(s);p.eventId=s.eventId;p.actionId=s.actionId;p.kills=s.kills;
  }
  function stepParty(p){
    if(p.phase!=='playing'||!p.members.some(m=>m.connected))return p;
    p.steps++;p.t+=DT;
    for(const m of p.members)partyContext(p,m,s=>{
      if(s.hero.hp<=0)return;
      if(!m.connected||p.steps-m.inputTick>PARTY_INPUT_TTL){m.input={};m.queued={};}
      stepHero(s,{...m.input,...m.queued});m.queued={};
    });
    for(const e of p.enemies){
      if(!alive(e))continue;
      let m=['windup','attack'].includes(e.phase)?p.members.find(m=>m.id===e.targetId):null;
      if(!m)m=p.members.filter(m=>alive(m.state.hero)).sort((a,b)=>distance(e,a.state.hero)-distance(e,b.state.hero)||a.id.localeCompare(b.id))[0];
      if(!m)continue;
      e.targetId=m.id;partyContext(p,m,s=>{
        // A committed strike may outlive its target. Finish its phase/angle,
        // but damageHero refuses the corpse and never transfers the strike.
        const phase=s.phase;s.phase='playing';stepEnemy(s,e);if(s.hero.hp<=0)s.phase='lost';else s.phase=phase;
      });
    }
    p.cleared=p.enemies.every(e=>!alive(e));if(p.members.every(m=>!alive(m.state.hero)))p.phase='lost';
    for(const m of p.members)Object.assign(m.state,{t:p.t,steps:p.steps,eventId:p.eventId,actionId:p.actionId,kills:p.kills,ev:p.ev});
    return p;
  }
  function partyView(p,id){
    const m=p.members.find(m=>m.id===id);if(!m)return null;
    m.state.partyPeers=p.members.filter(x=>x!==m).map(x=>({hero:x.state.hero,gift:x.state.gift,appearance:equipmentAppearance(x.state),connected:x.connected}));return m.state;
  }
  // Server-owned recovery data, NOT an accepted client save or a Gift credential.
  // Transport/storage owns atomic writes and authenticating the bound roster.
  // One area/run is retained exactly. No solo restore, replayed input, healing,
  // respawn, story award or old presentation event is generated by recovery.
  const PARTY_SAVE_VERSION='giftborne.2d-party-save.v1';
  const partyProgressKeys=['inventory','talents','trade','expedition','completed','resultCount','rewardClaimed','rewardReady'];
  const jsonCopy=value=>JSON.parse(JSON.stringify(value));
  function snapshotParty(p){
    if(p?.version!==PARTY_VERSION)throw Error('party-snapshot');
    return jsonCopy({version:PARTY_SAVE_VERSION,area:p.area,t:p.t,steps:p.steps,phase:p.phase,cleared:p.cleared,eventId:p.eventId,actionId:p.actionId,kills:p.kills,enemies:p.enemies,
      members:p.members.map(m=>({id:m.id,gift:m.state.gift,generation:m.generation,requiresBuild:combatBuilds.has(m.state),
        hero:{...m.state.hero,vx:0,vy:0,action:null,dodgeT:-99,invulnerable:false},
        progress:Object.fromEntries(partyProgressKeys.map(k=>[k,m.state[k]]))}))});
  }
  function restoreParty(data,{builds={}}={}){
    const fail=()=>{throw Error('party-snapshot');};
    const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
    const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
    const integer=x=>Number.isSafeInteger(x)&&x>=0&&x<Number.MAX_SAFE_INTEGER;
    const finiteTree=x=>typeof x==='number'?Number.isFinite(x):x===null||['string','boolean'].includes(typeof x)||typeof x==='object'&&Object.values(x).every(finiteTree);
    const same=(a,b)=>a===b||(Array.isArray(b)?Array.isArray(a)&&a.length===b.length&&b.every((v,i)=>same(a[i],v)):object(b)&&exact(a,Object.keys(b))&&Object.keys(b).every(k=>same(a[k],b[k])));
    if(!exact(data,['version','area','t','steps','phase','cleared','eventId','actionId','kills','enemies','members'])||data.version!==PARTY_SAVE_VERSION||!finiteTree(data)||
      !['crypt','boss'].includes(data.area)||!['playing','lost'].includes(data.phase)||typeof data.cleared!=='boolean'||
      !['steps','eventId','actionId','kills'].every(k=>integer(data[k]))||typeof data.t!=='number'||data.t<0||Math.abs(data.t-data.steps*DT)>1e-6*Math.max(1,data.t)||data.actionId>data.eventId||
      !Array.isArray(data.members)||data.members.length<1||data.members.length>5||!Array.isArray(data.enemies)||!object(builds))fail();
    for(const m of data.members)if(!exact(m,['id','gift','generation','requiresBuild','hero','progress'])||!integer(m.generation)||m.generation<1||m.generation>=Number.MAX_SAFE_INTEGER-1||typeof m.requiresBuild!=='boolean')fail();
    // createParty validates all IDs and the authored roster/area before applying
    // any stored state; failures never edit a live party supplied by the caller.
    const p=createParty({area:data.area,members:data.members.map(m=>({id:m.id,gift:m.gift}))});
    if(Object.keys(builds).some(id=>!p.members.some(m=>m.id===id))||data.enemies.length!==p.enemies.length)fail();
    const enemyConstants=['id','kind','maxHp','radius','windup','reach','arc','speed','damage','recovery','aggro'];
    for(let i=0;i<p.enemies.length;i++){
      const e=data.enemies[i],base=p.enemies[i],keys=Object.keys(base);
      if(!object(e)||!exact(e,[...keys,...(Object.hasOwn(e,'targetId')?['targetId']:[])])||enemyConstants.some(k=>e[k]!==base[k])||
        keys.some(k=>typeof e[k]!==typeof base[k])||e.hp<0||e.hp>e.maxHp||!['idle','chase','windup','attack','recovery','dead'].includes(e.phase)||
        (e.hp===0)!==(e.phase==='dead')||e.phaseT<0||e.dist<0||!integer(e.attackId)||![-1,1].includes(e.face)||
        Object.hasOwn(e,'targetId')&&!p.members.some(m=>m.id===e.targetId)||!campaign().walkable(levelOf(p.members[0].state),e.x,e.y,e.radius))fail();
    }
    if(data.kills!==data.enemies.filter(e=>e.hp===0).length||data.cleared!==data.enemies.every(e=>e.hp===0))fail();
    const progress=[];
    for(let i=0;i<p.members.length;i++){
      const m=data.members[i],h=m.hero,base=p.members[i].state.hero,g=m.progress;
      if(!exact(h,Object.keys(base))||Object.keys(base).some(k=>typeof h[k]!==typeof base[k])||h.id!==m.id||h.kind!=='player'||h.radius!==K.heroRadius||
        h.action!==null||h.invulnerable!==false||h.vx!==0||h.vy!==0||h.dodgeT!==-99||![-1,1].includes(h.face)||h.dist<0||
        !integer(h.maxHp)||h.maxHp<1||h.maxHp>10000||!integer(h.maxMana)||h.maxMana<1||h.maxMana>10000||h.hp<0||h.hp>h.maxHp||h.mana<0||h.mana>h.maxMana||
        !integer(h.potions)||h.potions>4||['attackCooldown','dodgeCooldown','skillCooldown','potionCooldown','cooldown'].some(k=>h[k]<0||h[k]>60)||
        !campaign().walkable(levelOf(p.members[i].state),h.x,h.y,h.radius)||!exact(g,partyProgressKeys)||!inventory().valid(g.inventory))fail();
      // This version has one shared area, no party transition/completion API.
      // Preserve personal state but reject story/progression from a different
      // contract instead of silently inventing a completion or ordinary gold.
      if(!same(g.talents,emptyTalents())||!same(g.trade,emptyTrade())||!same(g.expedition,emptyExpedition())||
        g.completed!==false||g.resultCount!==0||g.rewardClaimed!==false||g.rewardReady!==false)fail();
      if(m.requiresBuild&&!Object.hasOwn(builds,m.id))throw Error('party-build-required');
      progress.push(jsonCopy(g));
    }
    if((data.phase==='lost')!==data.members.every(m=>m.hero.hp===0))fail();
    Object.assign(p,{t:data.t,steps:data.steps,phase:data.phase,cleared:data.cleared,eventId:data.eventId,actionId:data.actionId,kills:data.kills,enemies:jsonCopy(data.enemies),ev:[]});
    const areaStates={camp:[],[p.area]:p.enemies};
    for(let i=0;i<p.members.length;i++){
      const m=p.members[i],saved=data.members[i],s=m.state;
      Object.assign(s,progress[i],{hero:jsonCopy(saved.hero),gift:saved.gift,t:p.t,steps:p.steps,phase:saved.hero.hp>0?'playing':'lost',
        eventId:p.eventId,actionId:p.actionId,kills:p.kills,enemies:p.enemies,areaStates,ev:p.ev});
      const build=Object.hasOwn(builds,m.id)?builds[m.id]:null,stats=inventory().stats(s.inventory);
      if(build===null){s.gift=stats.gift;s.hero.maxHp=stats.maxHp;s.hero.maxMana=stats.maxMana;s.hero.hp=Math.min(s.hero.hp,stats.maxHp);s.hero.mana=Math.min(s.hero.mana,stats.maxMana);}
      else bindCombatBuild(s,build);
      m.connected=false;m.generation=saved.generation+1;m.sequence=0;m.inputTick=p.steps-PARTY_INPUT_TTL;clearPartyInput(m);
    }
    return p;
  }
  const SIM = { DT, VIEW, K, LEVEL, GIFTS, getGift, getBuild, bindCombatBuild, equipmentAppearance, TALENTS, talentState, talentCommand, SHOP,SALE,tradeState,tradeCommand,create, start, restart, recover, equip, step, clearLine,levelOf,interaction,doorName,objective,snapshot,restore,inventoryCommand,PARTY_VERSION,PARTY_INPUT_TTL,createParty,partyInput,partyConnection,stepParty,partyView,PARTY_SAVE_VERSION,snapshotParty,restoreParty };
  root.SIM = SIM;
  if (typeof module !== 'undefined' && module.exports) module.exports = SIM;
})(typeof window !== 'undefined' ? window : globalThis);
