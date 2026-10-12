// Giftborne / Stoneford — original cut-out scene on the MIT ref2game renderer.
// Simulation coordinates are the actor's feet. Rendering never changes SIM state.
(function () {
  'use strict';
  const S = window.SCENE = window.SCENE || {}, L = window.LIB, M = L.M;
  const W = 1920, H = 1080, PI = Math.PI, TAU = PI * 2;
  const C = { ember: [1, .43, .16], gold: [1, .76, .36], teal: [.27, .89, .83],
    red: [.95, .24, .15], ink: [.06, .09, .1], dust: [.37, .43, .4] };
  const BIND = { hero_leg: [.05, .34, .92], enemy_leg: [.04, .30, .92],
    hero_arm: [.08, .50, .92], enemy_arm: [.08, .46, .92],
    hero_front_leg:[.03,.40,.94],hero_back_leg:[.03,.43,.96],
    hero_front_arm:[.06,.49,.94],hero_back_arm:[.06,.49,.94] };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, q) => a + (b - a) * q;
  const smooth = (q) => { q = clamp(q); return q * q * (3 - 2 * q); };
  const easePose = q=>(1-Math.cos(PI*clamp(q)))/2;
  const fract = (v) => v - Math.floor(v);
  const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v));
  const age = (t, stamp) => Number.isFinite(stamp) ? t - stamp : 1e6;
  const ARC = `
uniform vec3 u_col; uniform float u_angle, u_arc, u_progress, u_mode, u_amt;
void main(){
  vec2 q = v_uv * 2.0 - 1.0; float r = length(q);
  float a = atan(q.y, q.x), da = abs(atan(sin(a-u_angle),cos(a-u_angle)));
  float edge = 1.0-smoothstep(u_arc-.018,u_arc+.018,da);
  float disc = 1.0-smoothstep(.975,1.0,r);
  float outer = smoothstep(.945,.962,r)*disc;
  float sides = (1.0-smoothstep(.008,.035,abs(da-u_arc)))*smoothstep(.13,.22,r)*disc;
  float fill = disc*edge*(.13 + .17*smoothstep(1.0-u_progress,1.02-u_progress,r));
  float rune = smoothstep(.018,.0,abs(r-.7)) * edge * .22;
  float mask = u_mode < .5 ? fill + edge*outer*.85 + sides*.6 + rune :
    smoothstep(.64,.76,r)*(1.0-smoothstep(.9,1.,r))*edge;
  float opacity = min(1.,mask)*u_amt;
  o = vec4(u_col*opacity,opacity*(u_mode < .5 ? .68 : .16));
}`;
  const LIGHT = `
uniform vec3 u_col; uniform float u_amt;
void main(){ vec2 p=v_uv*2.-1.; float r=length(p);
  float a=exp(-r*r*3.)*(1.-smoothstep(.68,1.,r))*u_amt;
  o=vec4(u_col*a,0.); }
`;
  const PULSE = `
uniform vec3 u_col; uniform float u_amt;
void main(){ float r=length(v_uv*2.-1.);
  float edge=1.-smoothstep(.975,1.,r);
  float rim=smoothstep(.94,.97,r)*edge;
  float a=(edge*.12+rim*.88)*u_amt;
  o=vec4(u_col*a,a*.3); }
`;
  let initialized = false, quality = 'balanced', drawCalls = 0, counting = false;
  let clockState=null,terminalTime=null;
  function effectTime(st,time){
    if(clockState!==st){clockState=st;terminalTime=null;}
    if(st.phase==='won'||st.phase==='lost'){if(terminalTime===null)terminalTime=time;return st.t+Math.max(0,time-terminalTime);}
    terminalTime=null;return st.t;
  }
  S.REPEAT = [];
  S.diagnostics = { ready: false, renderer: 'WebGL2 / ref2game', quality };
  S.setQuality = (value) => { quality = value === 'low' ? 'low' : 'balanced'; return quality; };
  S.programs = () => {
    if (initialized) return;
    const pivot=!!window.GIFTBORNE?.state?.campaign;
    L.init(W, H, { giftArc: ARC, giftLight: LIGHT, giftPulse: PULSE, ...GIFT_WORLD.shaders, ...window.PIVOT_ATMOSPHERE?.shaders, ...window.PIVOT_SCENE?.shaders },pivot?{renderScale:.75,post:false}:{});
    L.SUN = [380, 175];
    const originalDraw = G.draw;
    G.draw = (...args) => { if (counting) drawCalls++; return originalDraw(...args); };
    initialized = true;
  };

  function textureExists(name) {
    try { return !!G.tex(name); } catch (_) { return false; }
  }
  function piece(name, matrix, w, h, pivot, u) {
    if (textureExists(name)) L.sprite(name, 0, 0, { m: matrix, w, h, pivot, u });
    else { // Deliberate development fallback; diagnostics exposes missing authored pieces.
      const p = M.ap(matrix, [-pivot[0], -pivot[1]]);
      L.solid(p[0], p[1], w, h, [.26, .33, .32], Math.atan2(matrix[1], matrix[0]), 0, 0, u.alpha);
    }
  }
  function arc(x, y, r, angle, spread, color, progress, amount, slash = false) {
    if(slash&&L.NOFX)return;
    G.draw(L.P.giftArc, { u_col: color, u_angle: angle, u_arc: spread,
      u_progress: progress, u_mode: slash ? 1 : 0, u_amt: amount }, G.xf(x - r, y - r, r * 2, r * 2));
  }
  function light(x, y, rx, ry, color, amount) {
    if(L.NOFX)return;
    G.blend('add'); G.draw(L.P.giftLight, { u_col: color, u_amt: amount }, G.xf(x - rx, y - ry, rx * 2, ry * 2)); G.blend();
  }
  // Two-link inverse kinematics. Screen-space targets preserve feet during stance.
  function solveIK(root, target, l1, l2, bend = 1) {
    const dx = target[0] - root[0], dy = target[1] - root[1];
    const distance = Math.hypot(dx, dy), d = clamp(distance, Math.abs(l1 - l2) + .001, l1 + l2 - .001);
    const direction = Math.atan2(dy, dx);
    const cosine = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const angle = direction + bend * Math.acos(cosine);
    const joint = [root[0] + Math.cos(angle) * l1, root[1] + Math.sin(angle) * l1];
    const end = [root[0] + Math.cos(direction) * d, root[1] + Math.sin(direction) * d];
    return { root, joint, end, target, reachError: Math.hypot(end[0] - target[0], end[1] - target[1]) };
  }
  function projectArm(ik,facing){
    const axis=ik.end.map((v,i)=>v-ik.root[i]),d2=axis[0]**2+axis[1]**2;
    const q=((ik.joint[0]-ik.root[0])*axis[0]+(ik.joint[1]-ik.root[1])*axis[1])/d2;
    const on=axis.map((v,i)=>ik.root[i]+v*q);
    ik.joint=on.map((v,i)=>v+(ik.joint[i]-v)*facing);return ik;
  }
  function limb(name, ik, width, face, uniforms, color, wristV=null) {
    const a1 = Math.atan2(-(ik.joint[0] - ik.root[0]) * face, ik.joint[1] - ik.root[1]);
    const a2 = wrap(Math.atan2(-(ik.end[0] - ik.joint[0]) * face, ik.end[1] - ik.joint[1]) - a1);
    const upperLength=Math.hypot(ik.joint[0]-ik.root[0],ik.joint[1]-ik.root[1]);
    const lowerLength=Math.hypot(ik.end[0]-ik.joint[0],ik.end[1]-ik.joint[1]);
    const [rootV, jointV, originalEndV] = BIND[name] || [.08, .5, .92],endV=wristV??originalEndV;
    // Map each painted half to its actual bone: view changes cannot change
    // anatomy or move a planted boot just because a crop has another knee UV.
    if (textureExists(name)) {
      const ov=.035,hu=upperLength/(jointV-rootV),hl=lowerLength/(endV-jointV);
      const mu=M.of(M.t(...ik.root),M.s(face,1),M.r(a1));
      const ml=M.of(M.t(...ik.joint),M.s(face,1),M.r(a1+a2));
      const cropEnd=wristV===null?1:wristV+.02;
      L.sprite(name,0,0,{m:ml,w:width,h:hl*(cropEnd-jointV+ov),src:[0,jointV-ov,1,cropEnd],pivot:[width/2,ov*hl],u:uniforms});
      L.sprite(name,0,0,{m:mu,w:width,h:hu*(jointV+ov),src:[0,0,1,jointV+ov],pivot:[width/2,rootV*hu],u:uniforms});
    }
    else {
      for (const [p, q] of [[ik.root, ik.joint], [ik.joint, ik.end]])
        L.solid(p[0] - width / 2, p[1], width, Math.hypot(q[0] - p[0], q[1] - p[1]), color,
          Math.atan2(q[1] - p[1], q[0] - p[0]) - PI / 2, width / 2, 0, uniforms.alpha);
    }
  }
  function legPose(wantedRoot,lean,face,scale,feet,view,kneeProjection=.3){
    const root=[...wantedRoot],length=45*scale,reach=length*2-.1;
    const offsets=[-11,11].map(x=>[Math.cos(lean)*x*scale,Math.sin(lean)*x*face*scale]);
    // The pelvis follows the support polygon. Correct the body, never the
    // planted targets, into the intersection of both reachable leg regions.
    for(let pass=0;pass<8;pass++)for(let i=0;i<2;i++){
      const dx=root[0]+offsets[i][0]-feet[i].target[0],dy=root[1]+offsets[i][1]-feet[i].target[1],d=Math.hypot(dx,dy);
      if(d>reach){root[0]-=dx*(1-reach/d);root[1]-=dy*(1-reach/d);}
    }
    const legs=feet.map((f,i)=>solveIK([root[0]+offsets[i][0],root[1]+offsets[i][1]],f.target,length,length,view==='side'?face:i?1:-1));
    // Knees bend partly into scene depth. A full 2D bend would turn the
    // foreshortened standing legs into a permanent sideways squat.
    for(const leg of legs){const mid=leg.root.map((v,i)=>(v+leg.end[i])/2);leg.joint=mid.map((v,i)=>v+(leg.joint[i]-v)*kneeProjection);}
    return {root,legs};
  }
  // Measured on the preserved part sheets (hip / knee / ankle / sole UV).
  // Spatial lengths and their fixed depth projection are shared with rest.
  // Each foot is a separate rigid texture sub-rect, not part of the shin.
  const HERO_LEG_BIND = {
    hero_leg: [.07,.37,.80,.978],
    hero_front_leg: [.04,.38,.81,.984],
    hero_back_leg: [.035,.405,.82,.982]
  };
  const HERO_LEG = GIFT_MOTION.HERO_RIG;
  // Generated closed gauntlet, separate from the preserved open-hand arm art.
  // Both wrist and hilt are measured in the prepared 256x152 source image.
  const HERO_HAND_BIND={wrist:[.19,.52],grip:[.71,.52],width:23,height:23*152/256};
  const HERO_POSES=Object.freeze({
    attack:[[0,0],[.095,-.7],[.19,0],[.33,1],[.48,0]],
    skill:[[0,0],[.125,-.7],[.25,0],[.39,1],[.62,0]],
    hurt:[[0,0],[.11,1],[.22,0]],
    dodge:[[0,0],[.125,1],[.25,0]],
    death:[[0,0],[.6,1]]
  });
  function authoredPose(name,t){
    const keys=HERO_POSES[name];if(t<=0)return keys[0][1];
    for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [a,v]=keys[i-1],[b,w]=keys[i];return mix(v,w,smooth((t-a)/(b-a)));}
    return keys.at(-1)[1];
  }
  const HERO_FOOT_BIND={
    hero_leg:{size:[190,510],u:[.34,.46,.405],heel:[.18,.925],toe:[.90,.972],support:[128,504]},
    hero_front_leg:{size:[141,483],u:[.50,.57,.56],heel:[.30,.979],toe:[.84,.979],support:[61,478]},
    hero_back_leg:{size:[135,471],u:[.50,.52,.48],heel:[.22,.977],toe:[.62,.977],support:[54,466]}
  };
  function heroLegPose(wantedRoot,lean,face,scale,feet,view,heading=null){
    const root=[...wantedRoot],offsets=[-1,1].map(s=>[Math.cos(lean)*s*HERO_LEG.hipHalfWidth*scale,Math.sin(lean)*s*HERO_LEG.hipHalfWidth*scale]);
    const targets=feet.map(f=>[f.target[0],f.target[1]-HERO_LEG.ankleHeight*scale]);
    const reach=(HERO_LEG.thigh+HERO_LEG.shin-HERO_LEG.reachInset)*scale;
    for(let pass=0;pass<60;pass++)for(let i=0;i<2;i++){
      const dx=root[0]+offsets[i][0]-targets[i][0],dy=root[1]+offsets[i][1]-targets[i][1],d=Math.hypot(dx,dy);
      if(d>reach){root[0]-=dx*(1-reach/d);root[1]-=dy*(1-reach/d);}
    }
    const vertical=heading===null?(view==='side'?0:1):smooth((Math.abs(Math.sin(heading))-.76)/.22);
    const side=heading===null?face:Math.cos(heading)<0?-1:1;
    const legs=targets.map((p,i)=>solveIK([root[0]+offsets[i][0],root[1]+offsets[i][1]],p,HERO_LEG.thigh*scale,HERO_LEG.shin*scale,1));
    // One fixed picture-plane projection of the knee bend, shared by neutral
    // and every action. Unlike the old rig this never changes with gait/state;
    // rest-ratio checks bound the resulting foreshortening on the actual drawing.
    for(const [i,leg]of legs.entries()){
      const axis=leg.end.map((v,i)=>v-leg.root[i]),d2=axis[0]**2+axis[1]**2;
      const q=((leg.joint[0]-leg.root[0])*axis[0]+(leg.joint[1]-leg.root[1])*axis[1])/d2;
      const pole=mix(side,i?1:-1,vertical);
      const on=axis.map((v,i)=>leg.root[i]+v*q);leg.joint=on.map((v,i)=>v+(leg.joint[i]-v)*HERO_LEG.kneeProjection*pole);
    }
    return {root,legs};
  }
  const heroNeutralLeg=heroLegPose([0,-HERO_LEG.rootHeight],0,1,1,[-1,1].map(side=>({target:[side*12,-4]})),'side').legs[0];
  const HERO_NEUTRAL_LENGTHS=[Math.hypot(heroNeutralLeg.joint[0]-heroNeutralLeg.root[0],heroNeutralLeg.joint[1]-heroNeutralLeg.root[1]),Math.hypot(heroNeutralLeg.end[0]-heroNeutralLeg.joint[0],heroNeutralLeg.end[1]-heroNeutralLeg.joint[1])];
  function heroLeg(name,ik,scale,face,u,footFace=face,footDepth=1){
    const [hip,knee,ankle,sole]=HERO_LEG_BIND[name];
    const pins=HERO_FOOT_BIND[name],overlap=.018;
    const draw=(p,q,start,end,pivotV,fromU,toU,endV)=>{
      const index=start===0?0:1,rawLength=Math.hypot((toU-fromU)*pins.size[0],(endV-pivotV)*pins.size[1]);
      const width=HERO_NEUTRAL_LENGTHS[index]*scale*pins.size[0]/rawLength,dx=width*(toU-fromU),bone=Math.hypot(q[0]-p[0],q[1]-p[1]);
      const height=Math.sqrt(Math.max(0,bone*bone-dx*dx))/(endV-pivotV),dy=height*(endV-pivotV);
      const a=Math.atan2(q[1]-p[1],q[0]-p[0])-Math.atan2(dy,dx*face);
      L.sprite(name,0,0,{m:M.of(M.t(...p),M.r(a),M.s(face,1)),w:width,h:height*(end-start),src:[0,start,1,end],pivot:[fromU*width,(pivotV-start)*height],u});
    };
    draw(ik.joint,ik.end,knee-overlap,ankle+.015,knee,pins.u[1],pins.u[2],ankle);
    draw(ik.root,ik.joint,0,knee+overlap,hip,pins.u[0],pins.u[1],knee);
    const [w,h]=pins.size,heel=[(pins.heel[0]-pins.u[2])*w,(pins.heel[1]-ankle)*h],toe=[(pins.toe[0]-pins.u[2])*w,(pins.toe[1]-ankle)*h];
    const angle=-Math.atan2(toe[1]-heel[1],toe[0]-heel[0]),height=Math.sin(angle)*(pins.support[0]-pins.u[2]*w)+Math.cos(angle)*(pins.support[1]-ankle*h);
    const unit=HERO_LEG.ankleHeight*scale/height,top=ankle-.045,footMatrix=M.of(M.t(...ik.end),M.s(footFace*footDepth,1),M.r(angle));
    L.sprite(name,0,0,{m:footMatrix,w:w*unit,h:h*unit*(1-top),src:[0,top,1,1],pivot:[pins.u[2]*w*unit,(ankle-top)*h*unit],u});
    // The anchors belong to that same rigid foot quad, never to an IK target.
    return {heel:M.ap(footMatrix,heel.map(v=>v*unit)),toe:M.ap(footMatrix,toe.map(v=>v*unit))};
  }
  function latestHit(st, actor) {
    const id = actor.id || 'hero';
    let result = 1e6;
    for (const e of (st.ev || [])) if ((e.k === 'hit' || e.k === 'hurt') && e.target === id)
      result = Math.min(result, S.effectsT - e.t);
    return result;
  }
  function giftId(st) { return st.gift || st.hero?.gift || st.equipped || 'sword'; }

  function drawActor(actor, st, hero, joints, ambientT = st.t) {
    const t = S.effectsT, isBoss = actor.kind === 'boss' || actor.boss || actor.id === 'boss';
    const scale = hero ? 1.12 : isBoss ? 1.36 : 1.08;
    const motion = S.recordedFrames?.get(st)?.motions[actor.id] || S.recordedActors?.get(actor)?.motion || GIFT_MOTION.update(actor, ambientT, scale, t);
    const view = hero ? motion.view : 'side';
    const face = view === 'side' ? motion.face : 1, id = actor.id || (hero ? 'hero' : 'enemy');
    const dead = actor.hp <= 0 || actor.phase === 'dead';
    const deathAge = motion.deathAge;
    const alpha = dead ? 1 - smooth((deathAge - 1.15) / 1.2) : 1;
    const speed = Math.hypot(actor.vx || 0, actor.vy || 0), move = motion.move;
    const dodgeAge = hero ? age(t, actor.dodgeT) : 1e6;
    const dodge = dodgeAge >= 0 && dodgeAge < .25 ? authoredPose('dodge',dodgeAge) : 0;
    const hitAge = latestHit(st, actor), hitFlash = hitAge >= 0 && hitAge < .12;
    const actionAgeEarly = age(t, actor.action?.t ?? actor.attackT);
    const actionContact = actor.action?.kind === 'skill' ? .25 : .19;
    const actionPose = hero && actor.action ? authoredPose(actor.action.kind==='skill'?'skill':'attack',actionAgeEarly) :
      !hero && actor.phase==='windup' ? -.6*smooth(actor.phaseT/actor.windup) : !hero && actor.phase==='attack' ? 1-clamp(actor.phaseT/.2) : 0;
    const recoil = hitAge>=0&&hitAge<.22 ? (hero?authoredPose('hurt',hitAge):Math.sin(PI*hitAge/.22)) : 0;
    const fall = dead ? (hero?authoredPose('death',deathAge):smooth(deathAge/.6)) : 0;
    const breath = dead||st.neutral?0:Math.sin(ambientT*2.1+actor.x*.002)*.7*(1-move)*scale;
    const bodyY = actor.y + motion.hipY + breath + dodge*9*scale + fall*(hero?HERO_LEG.rootHeight-24:50)*scale;
    const wantedRoot = [actor.x + motion.hipX + Math.cos(actor.aimAngle||0)*actionPose*5*scale, bodyY - (hero?HERO_LEG.rootHeight:60)*scale];
    const lean = dead ? (hero?1:face)*(fall*(hero?1.6:1.38)-Math.sin(clamp((deathAge-.45)/.25)*PI)*.07) :
      face*(move*.055+dodge*.27+actionPose*.13-recoil*.12)+clamp(motion.turn*.003,-.035,.035);
    const [footA,footB] = motion.feet.map(f=>({...f,target:[...f.target]}));
    if(dead){for(const [i,f] of [footA,footB].entries())f.target=[mix(f.target[0],actor.x-face*(hero?(i?82:65):(i?32:16))*scale,fall),mix(f.target[1],actor.y-(hero?(i?2:8):(i?4:10))*scale,fall)];}
    const projection=.2+move*(.05+.10*Math.abs(Math.cos(motion.heading)))+dodge*.10+fall*.18;
    const pose=hero?heroLegPose(wantedRoot,lean,face,scale,[footA,footB],view,motion.heading):legPose(wantedRoot,lean,face,scale,[footA,footB],view,projection),root=pose.root;
    const [legA,legB]=pose.legs;
    const chestDrop=hero&&!dead?(1-Math.cos(motion.phase*TAU*2))*1.5*scale*move:0;
    const bodyMatrix = M.of(M.t(root[0],root[1]+chestDrop), M.s(face, 1), M.r(lean));
    const bodyPoint = (x, y) => M.ap(bodyMatrix, [x * scale, y * scale]);
    const prefix = hero ? view==='side'?'hero_':'hero_'+view+'_' : 'enemy_';
    const localLight=GIFT_WORLD.lighting(actor.x,actor.y,S.world);
    const baseU = { alpha, grade: [.96, localLight.brightness*(hero?1.11:1.04), 0, 1.025],
      tint: [...(hitFlash ? [1.4, 1.15, .93] : localLight.tint), 1],
      rim: [.32+Math.max(localLight.fire,localLight.rune)*.45, -.004*face, -.006, 1], rimCol:localLight.rim };
    const farU = { ...baseU, grade: [.92,baseU.grade[1]*.88,0,1.025] };
    const attackAge = age(t, actor.attackT);
    const skillAge = age(t, actor.skillT);
    const inSkill = !dead && st.phase==='playing' && hero && actor.action?.kind === 'skill' && skillAge >= 0 && skillAge < .62;
    const inAttack = !dead && st.phase==='playing' && (hero ? actor.action?.kind === 'attack' && attackAge >= 0 && attackAge < .48 :
      actor.phase === 'windup' || actor.phase === 'attack' || actor.phase === 'recovery' && (actor.phaseT || 0) < .3);
    let actionAge = inSkill ? skillAge : attackAge;
    if (!hero) actionAge = actor.phase === 'windup' ? .16 * clamp((actor.phaseT || 0) / (actor.windup || .8)) :
      actor.phase === 'attack' ? .19 + (actor.phaseT || 0) : .35 + (actor.phaseT || 0);
    const contact = inSkill ? .25 : .19;
    const aim = inSkill ? (actor.skillAngle ?? actor.aimAngle ?? 0) : (actor.attackAngle ?? actor.aimAngle ?? (face > 0 ? 0 : PI));
    let swing = 0;
    if (inAttack || inSkill) {
      swing = actionAge < contact ? mix(-.95, hero?0:-.2, smooth(actionAge / contact)) :
        mix(hero?0:.05, 1.15, smooth((actionAge - contact) / .14));
    }
    // Anatomical carry follows continuous facing, not the discrete art view.
    // Otherwise changing side/front/back teleports the weapon to the other hand.
    const heading=motion.heading,along=Math.cos(heading),across=Math.sin(heading);
    const restingSwordAngle = hero?heading+.55*along:(face>0?-.65:-PI+.65);
    const gestureWeight = inSkill ? easePose(skillAge/.25)*(1 - easePose((skillAge - .36) / .26)) : hero && inAttack ? easePose(attackAge/.19)*(1 - easePose((attackAge - .25) / .23)) :
      !hero && actor.phase === 'recovery' ? 1 - smooth((actor.phaseT || 0) / .3) : 1;
    let swordAngle = (inAttack || inSkill) ? restingSwordAngle + (hero?wrap(aim-restingSwordAngle)+swing*face:wrap(aim+swing*face-restingSwordAngle))*gestureWeight : restingSwordAngle;
    if(hero&&dead)swordAngle+=wrap((face>0?0:-PI)-swordAngle)*fall;
    const shoulderX=hero?20*(along-across)/face:20;
    const shoulderNear = bodyPoint(shoulderX, -44), shoulderFar = bodyPoint(-shoulderX, -44);
    const gaitArm = Math.sin(motion.phase*TAU)*move;
    const restingHand = [shoulderNear[0] + (hero?along:face)*(11+gaitArm*10)*scale,shoulderNear[1]+(44-(hero?Math.max(0,-across)*12:0))*scale];
    // An away-facing blade uses a raised ready pose: elbow, wrist and fist
    // point together. Blend before changing art view, without an IK pole flip.
    const backReady=hero?smooth(clamp(-across/.45)):0;
    for(let i=0;i<2;i++)restingHand[i]=mix(restingHand[i],shoulderNear[i]+[Math.cos(restingSwordAngle),Math.sin(restingSwordAngle)][i]*48*scale,backReady);
    const idleHandAngle=Math.atan2(restingHand[1]-shoulderNear[1],restingHand[0]-shoulderNear[0]);
    const handAngle=idleHandAngle+(wrap(aim-idleHandAngle)+swing*face)*gestureWeight;
    const handReach=mix(Math.hypot(restingHand[0]-shoulderNear[0],restingHand[1]-shoulderNear[1]),40*scale,gestureWeight);
    let handNear = (inAttack || inSkill) ? [shoulderNear[0]+Math.cos(handAngle)*handReach,shoulderNear[1]+Math.sin(handAngle)*handReach] : restingHand;
    if(!hero&&(inAttack||inSkill))handNear=[mix(restingHand[0],shoulderNear[0]+Math.cos(swordAngle)*40*scale,gestureWeight),mix(restingHand[1],shoulderNear[1]+Math.sin(swordAngle)*31*scale,gestureWeight)];
    let handFar=[shoulderFar[0]-(hero?along:face)*(4+gaitArm*11+actionPose*13)*scale,shoulderFar[1]+(43-Math.abs(actionPose)*14)*scale];
    if(dodge){const q=dodge*dodge;handNear=handNear.map((v,i)=>mix(v,bodyPoint(32,mix(-10,-88,backReady))[i],q));handFar=handFar.map((v,i)=>mix(v,bodyPoint(-26,-24)[i],q));}
    if(dead){handNear=hero?handNear.map((v,i)=>mix(v,bodyPoint(24,20)[i],fall)):bodyPoint(24,20);handFar=hero?handFar.map((v,i)=>mix(v,bodyPoint(-23,16)[i],fall)):bodyPoint(-23,16);}
    const orb = hero && giftId(st) === 'orb',closedGrip=hero&&!orb;
    const [ar, ae, aw] = BIND[prefix + 'arm']||[.04,.49,.94], upper = (ae - ar) / (aw - ar);
    const wristV=closedGrip?.73:null,nearUpper=closedGrip?(ae-ar)/(wristV-ar):upper;
    const gripOffset=closedGrip?(HERO_HAND_BIND.grip[0]-HERO_HAND_BIND.wrist[0])*HERO_HAND_BIND.width*scale:0;
    const wristTarget=[handNear[0]-Math.cos(swordAngle)*gripOffset,handNear[1]-Math.sin(swordAngle)*gripOffset];
    const armNear = solveIK(shoulderNear,wristTarget,52*scale*nearUpper,52*scale*(1-nearUpper),closedGrip?1:-face);
    if(closedGrip)projectArm(armNear,along);
    const actualGrip=[armNear.end[0]+Math.cos(swordAngle)*gripOffset,armNear.end[1]+Math.sin(swordAngle)*gripOffset];
    const armFar = solveIK(shoulderFar, handFar, 50 * scale * upper, 50 * scale * (1 - upper), hero?1:face);
    if(hero)projectArm(armFar,along);
    const wind=GIFT_WORLD.windAt(actor.x,ambientT,S.world);
    const capeMatrix = M.of(bodyMatrix, M.t(-7 * scale, -49 * scale), M.r(-.06 - move * .11));
    const drawCape=()=>piece(hero?'hero_cape':'enemy_cape',capeMatrix,(isBoss?88:64)*scale,102*scale,
      [33*scale,5*scale],{...farU,sway:[.012+move*.009,6,ambientT*.95-actor.x*.003,2],lean:[wind*.038+move*.1*face,1]});
    const bladeLength = (hero ? 76 : isBoss ? 99 : 68) * scale;
    const weaponMatrix = M.of(M.t(...actualGrip), M.r(swordAngle + PI / 2));
    const swordTip = M.ap(weaponMatrix, [0, -bladeLength * .81]);
    const drawCarriedArm=()=>{
      limb(prefix + 'arm', armNear, 22 * scale, face, baseU, [.26, .3, .29],wristV);
      if (orb) {
        L.glow(...armNear.end, 29 * scale, C.teal, .4 + (inSkill ? .4 : 0));
        L.ring(...armNear.end, 12 * scale, 12 * scale, C.gold, .9, .16);
        L.star(...armNear.end, 15 * scale, C.teal, 1);
      } else {
        const weaponWidth = (hero ? 25 : isBoss ? 37 : 29) * scale;
        piece(hero?'hero_sword':'enemy_sword', weaponMatrix, weaponWidth, bladeLength, [weaponWidth / 2, bladeLength * .81],
          { ...baseU, grade: [.9, 1.2, 0, 1], rim: [.75, -.005, -.004, 1], rimCol: hero ? C.teal : C.red });
        if (!dead&&!L.NOFX) L.glow(...swordTip, 17 * scale, hero ? C.teal : C.ember, .17);
      }
      if(closedGrip){
        const b=HERO_HAND_BIND,w=b.width*scale,h=b.height*scale;
        piece('hero_closed_hand_v3',M.of(M.t(...actualGrip),M.r(swordAngle)),w,h,[b.grip[0]*w,b.grip[1]*h],baseU);
      }
    };
    const carryBehind=hero&&view==='back';
    if(carryBehind)drawCarriedArm();
    if(view!=='back')drawCape();
    limb(prefix + 'arm', armFar, 20 * scale, face, farU, [.2, .27, .26]);
    let soleA,soleB;
    if(hero){
      // A side boot shortens into depth before the front/back drawing changes;
      // its ankle and support plane stay fixed. No terrain or SIM correction.
      const footFace=along<-1e-6?-1:1,depth=view==='side'?Math.abs(along):1;
      soleA=heroLeg(prefix+'leg',legA,scale,face,farU,footFace,depth);soleB=heroLeg(prefix+'leg',legB,scale,face,baseU,footFace,depth);
    }
    else {limb(prefix + 'leg', legA, 24 * scale, face, farU, [.21, .28, .27]);limb(prefix + 'leg', legB, 24 * scale, face, baseU, [.26, .3, .29]);}
    const torsoWidth=isBoss?64:view==='side'?51:61;
    piece(prefix+'body',bodyMatrix,torsoWidth*scale,75*scale,[torsoWidth*.5*scale,67*scale],baseU);
    if(view==='back')drawCape();
    const headMatrix=M.of(bodyMatrix,M.t(0,-67*scale),M.r(-lean*.45*(hero&&dead?1-fall:1)+(inAttack?-.035:0)*face));
    piece(prefix + 'head', headMatrix, (hero ? 28 : 27) * scale, (hero ? 38 : 45) * scale,
      [(hero ? 14 : 13.5) * scale, (hero ? 32 : 39) * scale], baseU);
    if(!carryBehind)drawCarriedArm();
    if (!hero && !dead) {
      // Original enemy art, a broader commander cape, and an ember eye.
      const eye = M.ap(headMatrix, [7 * scale, -16 * scale]);
      if(!L.NOFX)L.glow(...eye, 9 * scale, C.red, .5);
      L.solid(actor.x - 30 * scale, actor.y - 160 * scale, 60 * scale, 5 * scale, C.ink, 0, 0, 0, .85);
      L.solid(actor.x - 30 * scale, actor.y - 160 * scale, 60 * scale * clamp(actor.hp / actor.maxHp), 5 * scale, isBoss ? C.gold : C.red);
    }
    const record = joints[id] = {
      root: [actor.x, actor.y], ground:[actor.x,actor.y],hip:root,hipL: legA.root, kneeL: legA.joint, ankleL:legA.end,footL:hero?[legA.end[0],legA.end[1]+HERO_LEG.ankleHeight*scale]:legA.end,
      hipR: legB.root, kneeR: legB.joint, ankleR:legB.end,footR:hero?[legB.end[0],legB.end[1]+HERO_LEG.ankleHeight*scale]:legB.end,
      ...(hero?{heelL:soleA.heel,toeL:soleA.toe,heelR:soleB.heel,toeR:soleB.toe,groundL:[footA.x,footA.groundY],groundR:[footB.x,footB.groundY]}:{}),
      shL:armFar.root,elbowL:armFar.joint,handL:armFar.end,shR:armNear.root,elbowR:armNear.joint,handR:actualGrip,wristR:armNear.end,grip:actualGrip,tip:swordTip,
      shoulder: armNear.root, elbow: armNear.joint, hand: actualGrip,
      head: M.ap(headMatrix, [0, -16 * scale]), swordTip, phase: motion.phase, view,
      stanceL: footA.stance, stanceR: footB.stance, moving: speed > 1,
      plantedL: [footA.x,footA.groundY],plantedR:[footB.x,footB.groundY],bodyRoot:root,
      localLight:{fire:localLight.fire,rune:localLight.rune},deathAge,
      footTargetError: Math.max(legA.reachError, legB.reachError), scale,
      animation: dead ? 'dead' : inSkill ? 'skill' : inAttack ? 'attack' : motion.dodge ? 'dodge' : move > .05 ? 'walk' : 'idle'
    };
    for (const [name, point] of Object.entries(record)) if (Array.isArray(point)) L.joint(id, name, point);
    return record;
  }

  function drawEvents(st, particleBudget) {
    if(L.NOFX)return 0;
    let particles = 0;
    for (const e of (st.ev || []).slice(-20)) {
      const a = S.effectsT - e.t;
      if (a < 0 || a > .7) continue;
      if (e.k === 'contact' && e.action === 'skill' && e.gift === 'orb' && a < .37) {
        // SIM resolves the entire radius instantly. Start at that full radius and
        // fade in place, anchored to the contact event, including after a dodge.
        const radius = e.reach, fade = (1 - a / .37) ** 1.4;
        G.draw(L.P.giftPulse, { u_col: C.teal, u_amt: .86 * fade },
          G.xf(e.x - radius, e.y - radius, radius * 2, radius * 2));
        light(e.x, e.y, radius, radius, C.teal, .17 * fade);
      }
      if ((e.k === 'hit' || e.k === 'hurt') && a < .34) {
        const q = a / .34, col = e.k === 'hurt' ? C.red : C.gold;
        const x = e.x, y = e.y - 65;
        L.glow(x, y, 48 * (1 - q) + 16, col, .48 * (1 - q));
        for (let j = 0; j < 6 && particles < particleBudget; j++, particles++) {
          const angle = j / 6 * TAU + L.rnd(e.id || 0, j), r = 9 + q * (45 + j * 3);
          L.star(x + Math.cos(angle) * r, y + Math.sin(angle) * r * .8, 5 * (1 - q) + 1, col, 1 - q);
        }
      }
      if (e.k === 'kill' && a < .65) {
        const q = a / .65;
        L.ring(e.x, e.y - 15, 18 + q * 54, 9 + q * 27, C.ember, .5 * (1 - q), .08);
        if (quality !== 'low') L.puff(e.x, e.y - 34 - q * 24, 30 + q * 33, C.ink, .45 * (1 - q), e.id || 1);
      }
      if (e.k === 'dodge' && a < .28 && quality !== 'low')
        L.puff(e.x, e.y - 5, 15 + a * 65, C.dust, .26 * (1 - a / .28), e.id || 1);
      if (e.k === 'win' && a < .7) L.ring(e.x, e.y, 35 + a * 150, 18 + a * 75, C.gold, 1 - a / .7, .06);
    }
    return particles;
  }
  function finish(t) {
    if (quality !== 'low'&&!L.NOFX) return L.finish(t, { bloom: [.10, .055], vignette: .78, warm: .4, roll: .6, dither: 0 });
    // Same scene and grade, one final pass; no hidden bloom work on the low tier.
    G.bind(null); G.blend('none');
    G.full(L.P.final, { u_src: L.T.comp, u_bloom: L.T.comp, u_bloom2: L.T.comp,
      u_t: t, u_bloomA: [0, 0], u_vig: .78, u_warm: .4, u_roll: .6, u_dither: 0 });
    G.blend();
  }

  S.render = (time = 0) => {
    if (!initialized) return;
    const st = S.state;
    if (!st || !st.hero) return;
    if(st.campaign){drawCalls=0;counting=true;const d=PIVOT_SCENE.render(st,time,quality);counting=false;S.diagnostics={ready:true,renderer:'WebGL2 / ref2game',version:'0.3.23-dev',quality,drawCalls,...d};window.__JOINTS=d.joints;return;}
    const recording=S.recordedFrames?.get(st)||S.recordedActors?.get(st.hero)?.frame,t=recording?.time??time;S.world=GIFT_WORLD.update(st,t);S.effectsT=recording?.effectsT??effectTime(st,t);
    const joints = {}, enemies = st.enemies || [], active = enemies.filter(e => e.hp > 0);
    drawCalls = 0; counting = true;
    L.beginBG([.025, .045, .049, 1]);
    if(textureExists('backdrop'))GIFT_WORLD.backdrop(S.world);
    GIFT_WORLD.background(S.world);
    const fire = .19 + Math.sin(t * 6.7) * .014 + Math.sin(t * 10.3 + 1.8) * .009;
    light(380, 175, 220, 170, C.ember, fire);
    light(410, 300, 290, 95, C.gold, .035);
    const shrine = window.SIM?.LEVEL?.shrine || { x: 1550, y: 570 };
    const sx = shrine.x ?? shrine[0] ?? 1550, sy = shrine.y ?? shrine[1] ?? 570;
    light(1540, 258, 180, 145, C.teal, .08 + Math.sin(t * 1.5) * .01);
    L.beginComp();
    GIFT_WORLD.ground(S.world,quality==='low');
    for (const e of st.phase==='playing'?active:[]) {
      if (e.phase === 'windup') arc(e.x, e.y, e.reach || 120, e.attackAngle || 0, e.arc || .72,
        C.red, clamp((e.phaseT || 0) / (e.windup || .8)), .7);
      if (e.phase === 'attack') arc(e.x, e.y, e.reach || 120, e.attackAngle || 0, e.arc || .72,
        C.ember, 1, Math.max(0, .7 - (e.phaseT || 0) * 3), true);
    }
    if (S.target && S.target.hp>0 && Number.isFinite(S.target.x)) {
      L.ring(S.target.x,S.target.y,31,13,C.gold,.66,.075);
    }
    const rewardReady = !active.length;
    L.ring(sx, sy, 59, 27, rewardReady ? C.gold : C.teal, rewardReady ? .9 : .28, .035);
    if (rewardReady) L.star(sx, sy - 63, 20, C.gold, .55 + Math.sin(t * 2) * .12);
    const heroColor = giftId(st) === 'orb' ? C.teal : C.gold;
    L.ring(st.hero.x, st.hero.y + 2, 45, 18, heroColor, .55, .045);
    const actors = enemies.filter(e => e.hp > 0 || age(st.t,e.deadT)<2.5).map(e=>({actor:e,hero:false})).concat({actor:st.hero,hero:true});
    actors.push(...GIFT_WORLD.grass.map(prop=>({prop,actor:{y:prop.y}})));
    actors.sort((a,b)=>a.actor.y-b.actor.y);
    for (const item of actors) {
      if(item.prop){const p=item.prop;GIFT_WORLD.plant('env_grass',p.x-p.w/2,p.y-p.h,p.w,p.h,S.world,1,st.hero);continue;}
      const a = item.actor;
      const illumination=GIFT_WORLD.lighting(a.x,a.y,S.world);
      L.shadow(a.x+illumination.shadowX,a.y+6,item.hero?42:48,11,a.hp<=0?.2:.44-S.world.cloud*.08);
      L.shadow(a.x,a.y+2,item.hero?23:27,6,a.hp<=0?.15:.54);
      drawActor(a, st, item.hero, joints, t);
    }
    const contactTarget=st.ev?.slice().reverse().find(e=>e.k==='hit'&&e.source==='hero'&&e.t>=st.hero.attackT),targetJ=joints[contactTarget?.target];
    if(targetJ){
      const j=joints.hero;
      j.targetLo=targetJ.hip;j.targetHi=targetJ.head;j.target=j.targetLo.map((v,i)=>(v+j.targetHi[i])/2);
      for(const name of ['target','targetLo','targetHi'])L.joint('hero',name,j[name]);
    }
    const h=st.hero,attackAge=age(S.effectsT,h.attackT),skillAge=age(S.effectsT,h.skillT);
    // Only the brief contact phase emits the cutting arc. Windup has no hit flash.
    if (h.action?.kind === 'attack' && attackAge >= .19 && attackAge < .39) {
      const q = (attackAge - .19) / .2;
      arc(h.x, h.y - 35, giftId(st) === 'orb' ? 126 : 130, (h.attackAngle ?? h.aimAngle ?? 0) + mix(-.6, .6, q),
        .62, heroColor, q, Math.sin(PI * q) * .85, true);
    }
    if (h.action?.kind === 'skill' && skillAge >= .25 && skillAge < .62) {
      const q = (skillAge - .25) / .37;
      if (giftId(st) !== 'orb') arc(h.x, h.y - 24, 180 + q * 40, (h.skillAngle ?? h.aimAngle ?? 0), .92, C.teal, q, .85 * (1 - q), true);
    }
    let particles = drawEvents(st, quality === 'low' ? 12 : 28);
    const emberCount = L.NOFX?0:quality === 'low' ? 6 : 13;
    for (let i = 0; i < emberCount; i++) {
      const life = fract(t * (.17 + L.rnd(i, 4) * .08) + L.rnd(i, 2));
      const wind=GIFT_WORLD.windAt(380,t,S.world)*19+life*24;
      const x = 365 + (L.rnd(i, 8) - .5) * 69 + wind;
      const y = 180 - life * (95 + L.rnd(i, 10) * 45);
      L.star(x, y, 2 + L.rnd(i, 9) * 2, C.ember, Math.sin(PI * life) * .6); particles++;
    }
    if (quality !== 'low' && !L.NOFX) {
      // One restrained mist band; it never obscures telegraphs or turns the art grey.
      L.fog(145, 460, [.0021, .016, .59, .07], [.16, .24, .25], 4, t, 0);
      for (let i = 0; i < 8; i++) {
        const x = fract(L.rnd(i, 13) + t * .006) * W, y = 360 + L.rnd(i, 14) * 430 + Math.sin(t * .6 + i) * 7;
        L.glow(x, y, 2.5, C.gold, .1); particles++;
      }
    }
    GIFT_WORLD.foreground(S.world,st,quality==='low');
    finish(t);
    counting = false;
    const required = ['backdrop','env_branch','env_ivy','env_grass','env_banner','hero_closed_hand_v3',...['hero_front_','hero_back_'].flatMap(p=>['head','body','arm','leg'].map(n=>p+n)), ...['hero_', 'enemy_'].flatMap(p => ['body', 'head', 'arm', 'leg', 'sword', 'cape'].map(n => p + n))];
    S.diagnostics = { ready: true, renderer: 'WebGL2 / ref2game',version:'0.2.0', quality, actorCount: actors.filter(a=>!a.prop).length,
      activeEnemies: active.length, particleCount: particles, drawCalls, joints,
      missingAssets: required.filter(n => !textureExists(n)), frameTime: t,
      maxFootTargetError: Math.max(0, ...Object.values(joints).map(j => j.footTargetError)),
      usesWorldSpaceFootPlants:true,weather:{...S.world},layers:['ground','scenery','actors','foreground','weather'],physicalDeviceClaim:false };
    window.__JOINTS = joints;
  };
  // Pure functions are exposed narrowly for numerical rig checks without a GPU.
  S.rigMath = Object.freeze({ solveIK, legPose, heroLegPose, heroLegBind:HERO_LEG_BIND,heroFootBind:HERO_FOOT_BIND,heroHandBind:HERO_HAND_BIND,heroLeg:HERO_LEG,authoredPose,heroPoses:HERO_POSES,effectTime, drawActor, update:GIFT_MOTION.update });
})();
