/* New hero, actual SIM + recorded presentation. Legacy QA remains ?legacy. */
(function(){
 if(new URLSearchParams(location.search).has('legacy'))return;
 const S=SCENE,frames=S.pivotFrames=new WeakMap(),copy=x=>JSON.parse(JSON.stringify(x));
 function capture(st,time=st.t){const motions={};for(const a of [st.hero,...st.enemies])motions[a.id]=GIFT_MOTION.update(a,time,a.id==='hero'?1:a.kind==='boss'?1.3:a.kind==='sentinel'?1:.88,st.t);const snap=copy(st);frames.set(snap,{motions,time});return snap;}
 function setup(angle=0){const s=SIM.start(SIM.create({campaign:true}));s.area='boss';s.enemies=[];Object.assign(s.hero,{x:960,y:590,aimAngle:angle});capture(s);return s;}
 const step=(s,i)=>{SIM.step(s,i);return capture(s);};
 // Initial staging only; every chase, telegraph, contact and recovery is SIM.
 function enemySequence(kind,angle){
  const s=SIM.start(SIM.restore({version:1,area:kind==='boss'?'boss':'crypt',gift:'sword',hp:100,mana:100,potions:4,enemies:{}}));
  const e=s.enemies.find(e=>e.kind===kind);s.area='boss';s.enemies=[e];
  Object.assign(e,{x:960,y:640,aimAngle:angle,face:Math.cos(angle)<0?-1:1});
  Object.assign(s.hero,{x:960+Math.cos(angle)*220,y:640+Math.sin(angle)*220});
  const seq=[capture(s)],events=[];let impact=-1,done=false;
  for(let n=0;n<360&&!done;n++){
   const id=s.eventId;SIM.step(s,{});const ev=s.ev.filter(v=>v.id>id);events.push(...ev);
   seq.push(capture(s));if(ev.some(v=>v.k==='enemyAttack'))impact=seq.length-1;
   done=impact>=0&&e.phase==='chase';
  }
  return {kind,angle,id:e.id,frames:seq,events,impact,heroHp:s.hero.hp,damage:e.damage};
 }
 S.enemySequence=enemySequence;
 S.QA=()=>{const Q={states:[],cycles:{},loops:{},subject:{},cycleT:{},rest:{},attacks:{},transitions:{},sprites:{},actors:['hero'],note:'New paladin numerical rig scope; enemy directions, HUD and physical acceptance not certified.',box:(n,s)=>[s.hero.x-130,s.hero.y-190,260,225]};
 for(let d=0;d<8;d++){
  const angle=d*Math.PI/4,name='hero_'+d,s=setup(angle),input={mx:Math.cos(angle),my:Math.sin(angle)},aim={aimX:s.hero.x+Math.cos(angle)*100,aimY:s.hero.y+Math.sin(angle)*100};
  for(let n=0;n<30;n++)step(s,aim);Q.rest[name]=capture(s);Q.states.push(['rest_'+d,Q.rest[name]]);
  for(let n=0;n<30;n++)step(s,input);let phase=frames.get(capture(s)).motions.hero.phase;
  for(let n=0;n<90&&Math.abs(phase-Math.round(phase))>.001;n++){step(s,input);phase=frames.get(capture(s)).motions.hero.phase;}
  const end=phase+1,seq=[];for(let n=0;n<90&&phase<end-.001;n++){seq.push(capture(s));step(s,input);phase=frames.get(capture(s)).motions.hero.phase;}
  Q.cycles[name]=seq;Q.cycleT[name]=seq.length/60;Q.subject[name]='hero';Q.sprites[name]=Object.keys(PIVOT_ASSETS).filter(k=>k.startsWith('paladin_')||k==='gift_sword');
  const tr=setup(angle),ts=[];for(let n=0;n<120;n++)ts.push(step(tr,n>=15&&n<45?input:n===60?{act:true,...aim}:n===95?{dodge:true,...input}:aim));Q.transitions[name+'_start_stop_attack_dodge']=ts;Q.subject[name+'_start_stop_attack_dodge']='hero';
 }
 const turn=setup(),seq=[];for(let n=0;n<300;n++){const angle=clamp((n-30)/240)*Math.PI*2;seq.push(step(turn,{aimX:turn.hero.x+Math.cos(angle)*100,aimY:turn.hero.y+Math.sin(angle)*100}));}Q.transitions.hero_turn=seq;Q.subject.hero_turn='hero';
 for(const kind of ['raider','sentinel','boss']){
  const sequences=Array.from({length:24},(_,n)=>enemySequence(kind,n*Math.PI/12));
  Q.attacks[kind+'_contact_360']={subject:sequences[0].id,states:sequences.map(q=>q.frames[q.impact])};
 }
 Q.anim={};
 for(const [name,area,kind,box]of [
  ['camp_water','camp','water',[1160,145,100,55]],
  ['camp_fire','camp','fire',[264,186,40,44]],
  ['camp_wind','camp','banner',[548,124,36,62]],
  ['crypt_water','crypt','water',[250,530,70,25]],
  ['crypt_fall','crypt','fall',[64,526,33,65]],
  ['crypt_vapour','crypt','haze',[252,587,85,34]],
  ['boss_fire','boss','fire',[530,71,32,46]]
 ]){
  const base=SIM.start(SIM.restore({version:1,area,gift:'sword',hp:100,mana:100,potions:4,enemies:{}}));
  const on=Array.from({length:20},(_,i)=>({...copy(base),t:12+i/60,atmosphereOnly:kind}));
  Q.anim[name]={on,off:on.map(s=>({...copy(s),atmosphereOff:true})),box};
 }
 Q.note+=' Enemy coverage adds actual contact frames in 24 directions per type, not all enemy walk/death rig checks. Atmosphere anim checks isolate each region/kind on the active pivot.';
 return Q;};
 function clamp(x){return Math.max(0,Math.min(1,x));}
 S.capturePivotFrame=capture;
})();
