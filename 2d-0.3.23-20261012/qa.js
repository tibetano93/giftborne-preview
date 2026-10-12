/* Real fixed-step SIM samples + recorded production presentation, not a second rig.
 * Each JSON SIM snapshot keeps its own immutable render sample in a WeakMap.
 * Replaying frames out of order must not re-initialize the planted-foot solver.
 * Hero-only scope: enemy rigs and DOM HUD are deliberately not certified here. */
(function(){
 const S=window.SCENE,frames=S.recordedFrames=new WeakMap(),actors=S.recordedActors=new WeakMap();
 const copy=x=>JSON.parse(JSON.stringify(x));
 function capture(st,time=st.t){
  const motions={},effectsT=S.rigMath.effectTime(st,time);
  for(const a of [st.hero,...st.enemies])motions[a.id]=GIFT_MOTION.update(a,time,a.id==='hero'?1.12:a.kind==='boss'?1.36:1.08,effectsT);
  const snap=copy(st),frame={time,effectsT,motions};frames.set(snap,frame);
  for(const a of [snap.hero,...snap.enemies])actors.set(a,{motion:motions[a.id],frame});return snap;
 }
 function setup(angle=0){
  const st=SIM.restart('sword');st.hero.x=960;st.hero.y=720;st.hero.aimAngle=angle;st.enemies=[];
  capture(st);return st;
 }
 function step(st,input){SIM.step(st,input);return capture(st);}
 const dirs=['east','southeast','south','southwest','west','northwest','north','northeast'];
 S.QA=()=>{
  const Q={states:[],cycles:{},loops:{},subject:{},cycleT:{},rest:{},attacks:{},transitions:{},sprites:{},actors:['hero'],
   note:'Hero rig only; original SIM at 60 Hz. Enemy rigs and DOM HUD are not acceptance claims.',
   box:(name,st)=>[st.hero.x-190,st.hero.y-220,450,300]};
  const textures=Object.keys(ASSETS).filter(n=>n.startsWith('hero_'));
  for(let d=0;d<8;d++){
   const angle=d*Math.PI/4,name='hero_'+dirs[d],st=setup(angle),input={mx:Math.cos(angle),my:Math.sin(angle)};
   st.hero.x=960-Math.cos(angle)*120;st.hero.y=690-Math.sin(angle)*120;GIFT_MOTION.reset(st.hero);capture(st);
   // Settle view and idle support before the actual travelling cycle.
   for(let n=0;n<30;n++)step(st,{aimX:st.hero.x+Math.cos(angle)*100,aimY:st.hero.y+Math.sin(angle)*100});
   Q.rest[name]=capture(st);Q.rest[name].neutral=true;
   Q.states.push(['rest_'+dirs[d],Q.rest[name]]);
   for(let n=0;n<30;n++)step(st,input);
   let phase=frames.get(capture(st)).motions.hero.phase;
   while(Math.abs(phase-Math.round(phase))>.001){step(st,input);phase=frames.get(capture(st)).motions.hero.phase;}
   const cycle=[],endPhase=phase+1;
   while(phase<endPhase-.001){cycle.push(capture(st));step(st,input);phase=frames.get(capture(st)).motions.hero.phase;}
   Q.cycles[name]=cycle;Q.cycleT[name]=cycle.length/60;Q.subject[name]='hero';Q.sprites[name]=textures;
   // All transitions are contiguous 1/60 frames, including their quiet lead-in.
   const tr=setup(angle),sequence=[];
   for(let n=0;n<150;n++){
    const aim={aimX:tr.hero.x+Math.cos(angle)*100,aimY:tr.hero.y+Math.sin(angle)*100};
    const i=n>=20&&n<50?{...input,...aim}:n===70?{act:true,...aim}:n===110?{dodge:true,...input,...aim}:aim;
    sequence.push(step(tr,i));
   }
   Q.transitions[name+'_idle_walk_attack_dodge']=sequence;Q.subject[name+'_idle_walk_attack_dodge']='hero';
  }
  const impacts=[];
  for(let d=0;d<24;d++){
   const angle=d*Math.PI/12,st=setup(angle),e=SIM.create().enemies[0];
   Object.assign(e,{x:st.hero.x+Math.cos(angle)*110,y:st.hero.y+Math.sin(angle)*110,speed:0,windup:10});st.enemies=[e];
   for(let n=0;n<20;n++)step(st,{aimX:e.x,aimY:e.y});
   step(st,{act:true,aimX:e.x,aimY:e.y});
   for(let n=0;n<12;n++)step(st,{aimX:e.x,aimY:e.y});
   impacts.push(capture(st));
  }
  Q.attacks.hero_sword_360={subject:'hero',states:impacts};
  Q.states.push(['match',impacts[0]]);
  const turn=setup(0),turnFrames=[];
  for(let n=0;n<300;n++){
   const angle=Math.max(0,Math.min(1,(n-30)/240))*Math.PI*2;
   turnFrames.push(step(turn,{aimX:turn.hero.x+Math.cos(angle)*100,aimY:turn.hero.y+Math.sin(angle)*100}));
  }
  Q.transitions.hero_turn_360=turnFrames;Q.subject.hero_turn_360='hero';
  // A real enemy contact supplies hurt/death events; no presentation-only damage.
  for(const lethal of [false,true])for(let d=0;d<8;d++){
   const angle=d*Math.PI/4,st=setup(angle),e=SIM.create().enemies[0];Object.assign(e,{x:st.hero.x+Math.cos(angle)*80,y:st.hero.y+Math.sin(angle)*80,phase:'windup',phaseT:.65,attackAngle:angle+Math.PI,speed:0});st.enemies=[e];
   if(lethal)st.hero.hp=1;
   const sequence=[];let time=0;
   for(let n=0;n<110;n++){if(st.phase==='playing')SIM.step(st,{});time+=SIM.DT;sequence.push(capture(st,time));}
   const name=(lethal?'hero_death_':'hero_hurt_')+dirs[d];Q.transitions[name]=sequence;Q.subject[name]='hero';if(d===0)Q.states.push([name,sequence[lethal?60:14]]);
  }
  return Q;
 };
 S.captureFrame=capture;
})();
