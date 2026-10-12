/* New authored 2D assets in the existing renderer; no second game or SIM.
 * Foot plants are world-space; calibrated joints belong to these new drawings.
 * A single identity is drawn per SIM actor. Contact FX consume SIM events only. */
(function(){
 'use strict';
 const L=LIB,M=L.M,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
 const smooth=q=>{q=clamp(q);return q*q*(3-2*q);},wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const hermite=(a,b,va,vb,duration,q)=>{q=clamp(q);return (2*q**3-3*q*q+1)*a+(q**3-2*q*q+q)*va*duration+(-2*q**3+3*q*q)*b+(q**3-q*q)*vb*duration;};
 function playerPose(kind,age){
  const keys=SCENE.rigMath.heroPoses[kind];if(age<=0||age>=keys.at(-1)[0])return 0;
  // Keep the authored key poses and SIM contact time, but carry velocity
  // THROUGH contact instead of easing to a stop on the damage tick.
  const contactVelocity=(keys[3][1]-keys[1][1])/(keys[3][0]-keys[1][0]);
  for(let i=1;i<keys.length;i++)if(age<=keys[i][0]){
   const [a,v]=keys[i-1],[b,w]=keys[i];return hermite(v,w,i-1===2?contactVelocity:0,i===2?contactVelocity:0,b-a,(age-a)/(b-a));
  }
  return 0;
 }
 function enemyPose(a,t){
  const rest={weight:0,blade:0,arm:0,reach:36,lean:0};
  if(a.phase==='windup'){
   // Contact occurs on the first fixed SIM tick at/after the authored windup.
   // Align the pose clock to that tick instead of braking in a fractional frame.
   const windup=Math.ceil((a.windup-1e-9)/SIM.DT)*SIM.DT,lead=Math.min(.2,windup*.4),prepare=windup-lead;
   if(a.phaseT<prepare){const q=smooth(a.phaseT/prepare);return{weight:q,blade:-.9,arm:-.45,reach:36,lean:-.06*q};}
   const q=(a.phaseT-prepare)/lead;
   return{weight:1,blade:hermite(-.9,0,0,6,lead,q),arm:hermite(-.45,0,0,3,lead,q),reach:hermite(36,46,0,0,lead,q),lean:hermite(-.06,.08,0,.6,lead,q)};
  }
  if(a.phase==='attack'){const q=a.phaseT/.18;return{weight:1,blade:hermite(0,.55,6,0,.18,q),arm:hermite(0,.22,3,0,.18,q),reach:mix(46,44,smooth(q)),lean:hermite(.08,.11,.6,0,.18,q)};}
  if(a.phase==='recovery'&&t-a.attackT<.18+a.recovery+.02){const q=smooth(a.phaseT/.3);return{weight:1-q,blade:.55,arm:.22,reach:44,lean:.11*(1-q),recovery:q};}
  return rest;
 }
 const P=window.PIVOT_SCENE={};
 // Reuse the plate's pixels as a depth-sorted prop. Unlike the old all-after-
 // actors overlay this does not hide an actor standing IN FRONT of the base.
 P.shaders={pivotForeground:`uniform sampler2D u_tex;uniform vec4 u_box;uniform vec2 u_points[8];uniform int u_count;
void main(){vec2 p=u_box.xy+v_uv*u_box.zw;bool inside=false;float d=10000.;
for(int i=0;i<8;i++){if(i>=u_count)break;int j=i+1;if(j>=u_count)j=0;vec2 a=u_points[i],b=u_points[j],v=b-a;
d=min(d,length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.001),0.,1.)));
if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}
float alpha=inside?smoothstep(0.,1.,d):0.;o=vec4(texture(u_tex,p/vec2(1672.,941.)).rgb*alpha,alpha);}`};
 const propCache=new WeakMap();
 P.depthEntries=(level,actors)=>[
  ...actors.map(actor=>({actor,y:actor.y})),
  ...(level.foreground||[]).map(prop=>({prop,y:prop.base[1]*1080/941}))
 ].sort((a,b)=>a.y-b.y||(a.prop?-1:b.prop?1:0));
 function drawProp(prop,background){
  let q=propCache.get(prop);
  if(!q){
   if(prop.points.length<3||prop.points.length>8)throw Error('Foreground outline must have 3–8 points');
   const xs=prop.points.map(p=>p[0]),ys=prop.points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
   const points=new Float32Array(16);prop.points.forEach((p,i)=>points.set(p,i*2));
   q={xf:[w*1920/1672,0,0,0,h*1080/941,0,x*1920/1672,y*1080/941,1],u:{u_box:[x,y,w,h],u_points:points,u_count:prop.points.length}};
   propCache.set(prop,q);
  }
  G.draw(L.P.pivotForeground,{...q.u,u_tex:G.tex(background)},q.xf);
 }
 const pins={
  // Pin inside the pauldron, not at its upper rim: the painted cap overlaps
  // the sleeve socket while the numerical shoulder/arm lengths stay unchanged.
  front:{leg:[[.37,.035],[.41,.44],[.42,.82]],arm:[[.39,.14],[.39,.48],[.66,.90]]},
  side:{leg:[[.37,.035],[.40,.43],[.42,.82]],arm:[[.39,.14],[.42,.48],[.66,.90]]},
  back:{leg:[[.42,.035],[.46,.43],[.43,.82]],arm:[[.48,.14],[.63,.48],[.36,.90]]}
 };
 const shade={alpha:1,grade:[.97,1,0,1]};
 function part(name,x,y,w,h,px,py,rotation=0,face=1,u=shade){
  L.sprite(name,0,0,{m:M.of(M.t(x,y),M.r(rotation),M.s(face,1)),w,h,pivot:[px*w,py*h],u});
 }
 function segment(name,p,q,start,end,a,b,face,u){
  const tex=G.tex(name),dx=(b[0]-a[0])*tex.w,dy=(b[1]-a[1])*tex.h;
  const unit=Math.hypot(q[0]-p[0],q[1]-p[1])/Math.hypot(dx,dy),w=tex.w*unit,h=tex.h*unit;
  const angle=Math.atan2(q[1]-p[1],q[0]-p[0])-Math.atan2(dy,dx*face);
  L.sprite(name,0,0,{m:M.of(M.t(...p),M.r(angle),M.s(face,1)),w,h:h*(end-start),src:[0,start,1,end],pivot:[a[0]*w,(a[1]-start)*h],u});
 }
 function limb(name,ik,p,face,u){segment(name,ik.joint,ik.end,p[1][1]-.025,1,p[1],p[2],face,u);segment(name,ik.root,ik.joint,0,p[1][1]+.025,p[0],p[1],face,u);}
 function drawPaladin(a,st,t,appearance=SIM.equipmentAppearance(st)){
  const s=1,m=SCENE.pivotFrames?.get(st)?.motions[a.id]||GIFT_MOTION.update(a,t,s,st.t),view=m.view,face=m.face,prefix='paladin_'+view+'_';
  const dead=a.hp<=0,fall=clamp(m.deathAge/.48),hurt=clamp(1-(st.t-a.hurtT)/.2);
  const action=a.action,age=action?st.t-action.t:0,pose=action?playerPose(action.kind,age):0;
  const duration=action?.kind==='skill'?.62:.48,contact=action?.kind==='skill'?.25:.19;
  const weight=action?(age<=contact?smooth(age/contact):1-smooth((age-contact)/(duration-contact))):0;
  // Follow the existing planted-foot phase, not another elapsed-time oscillator.
  // A small pelvic drop and opposing chest roll carry weight across each step.
  // Attacks blend out that pose at contact; death/dodge own their presentation.
  const gait=dead||m.dodge?0:Math.sin(m.phase*Math.PI*2)*m.move*(1-weight);
  const pelvisRoll=-.03*gait,hipOffsets=[-8,8].map(x=>[x*Math.cos(pelvisRoll),x*Math.sin(pelvisRoll)]);
  const u={...shade,alpha:dead?1-clamp((m.deathAge-2)/1.2):1,tint:[1,.35,.25,hurt*.3]};
  let root=[a.x+m.hipX,a.y-80+m.hipY+fall*53];
  const feet=m.feet,targets=feet.map(f=>[f.x,f.y-11]);
  for(let k=0;k<20;k++)for(let i=0;i<2;i++){
   const dx=root[0]+hipOffsets[i][0]-targets[i][0],dy=root[1]+hipOffsets[i][1]-targets[i][1],d=Math.hypot(dx,dy);
   if(d>68.5){root[0]-=dx*(1-68.5/d);root[1]-=dy*(1-68.5/d);}
  }
  const legs=targets.map((p,i)=>SCENE.rigMath.solveIK([root[0]+hipOffsets[i][0],root[1]+hipOffsets[i][1]],p,34,36,1)),footTrace=[];
  // Two painted views share one ankle/sole and remain full-area at north/south.
  // Rotating a side-view boot upside down, or signed-scaling it through zero,
  // cannot represent that turn. Blend the UV samples in one opaque draw.
  const footTurn=smooth((Math.cos(m.heading)+.7)/1.4),footLength=.7+.3*Math.abs(Math.cos(m.heading));
  for(const leg of legs){const dx=leg.end[0]-leg.root[0],dy=leg.end[1]-leg.root[1],q=((leg.joint[0]-leg.root[0])*dx+(leg.joint[1]-leg.root[1])*dy)/(dx*dx+dy*dy);const line=[leg.root[0]+dx*q,leg.root[1]+dy*q];leg.joint=leg.joint.map((v,i)=>line[i]+(v-line[i])*.45*Math.cos(m.heading));}
  for(let i=0;i<2;i++){
   const ik=legs[i],p=pins[view].leg,name=prefix+'leg';
   segment(name,ik.joint,ik.end,p[1][1]-.025,p[2][1]+.02,p[1],p[2],face,{...u,grade:[i?.97:.72,1,0,1]});
   segment(name,ik.root,ik.joint,0,p[1][1]+.025,p[0],p[1],face,u);
   const tx=G.tex(name),unit=11/(tx.h*(.975-p[2][1])),w=tx.w*unit,h=tx.h*unit,start=p[2][1]-.025;
   const span=Math.max(p[2][0],1-p[2][0]),footM=M.of(M.t(...ik.end),M.s(footLength,1));
   L.sprite(name,0,0,{m:footM,w:2*span*w,h:h*(1-start),src:[0,start,1,1],pivot:[span*w,(p[2][1]-start)*h],u:{...u,turn:[footTurn,p[2][0],span,1]}});
   const sole=(x)=>M.ap(footM,[(x-p[2][0])*w*(2*footTurn-1),(.975-p[2][1])*h]);
   footTrace.push({heel:sole(.22),toe:sole(.85),area:footLength});
  }
  const lean=dead?fall*.7*face:hurt*.12*face+.045*gait;
  const body=(x,y)=>M.ap(M.of(M.t(root[0],root[1]),M.r(lean)),[x,y]);
  // Anatomical left/right lie ACROSS the travel direction. Project depth into
  // screen Y: facing the camera exposes two shoulders, side-on stacks them.
  // The torso's painted arm socket row is .225. Place the articulated shoulder
  // on that SAME body transform, not nine pixels below the attachment.
  const shoulderY=-22+(.225-.57)*85;
  const lateral=-Math.sin(m.heading),depth=Math.cos(m.heading),neck=body(0,-57),head=body(0,-72),shoulders=[body(-22*lateral,shoulderY-depth*6),body(22*lateral,shoulderY+depth*6)];
  const right=1,carry=body(30*lateral+depth*8,-5+depth*6),leftHand=body(-30*lateral+depth*4,-5-depth*6);
  let grip=carry;
  if(action){const a0=Math.atan2(carry[1]-shoulders[right][1],carry[0]-shoulders[right][0]),r0=Math.hypot(carry[0]-shoulders[right][0],carry[1]-shoulders[right][1]);
   const attack=action.angle+pose*.9,dx=Math.cos(attack)*38,dy=30+Math.sin(attack)*18,a1=Math.atan2(dy,dx),base=Math.atan2(30+Math.sin(action.angle)*18,Math.cos(action.angle)*38),r1=Math.hypot(dx,dy),a=a0+(wrap(base-a0)+wrap(a1-base))*weight,r=mix(r0,r1,weight);grip=[shoulders[right][0]+Math.cos(a)*r,shoulders[right][1]+Math.sin(a)*r];
  }else if(m.move>.05){const swing=feet.map(f=>((f.x-a.x)*Math.cos(m.heading)+(f.groundY-a.y+4)*Math.sin(m.heading))*m.move);
   grip=[carry[0]-swing[1]*Math.cos(m.heading)*.36,carry[1]-swing[1]*Math.sin(m.heading)*.2];leftHand[0]-=swing[0]*Math.cos(m.heading)*.36;leftHand[1]-=swing[0]*Math.sin(m.heading)*.2;}
  if(!action)grip[1]=Math.min(grip[1],a.y-80);
  const hands=right?[leftHand,grip]:[grip,leftHand],arms=hands.map((h,i)=>{
   const root=shoulders[i],distance=Math.hypot(h[0]-root[0],h[1]-root[1]);
   // Soft reach avoids the two-bone singularity at full extension. A planted
   // step must not snap the elbow when the requested carry briefly exceeds52.
   // Position and first derivative match at42; reach tends to50, never52.
   const reach=distance>42?42+8*(1-Math.exp(-(distance-42)/8)):distance;
   const target=distance>0?h.map((v,k)=>root[k]+(v-root[k])*reach/distance):h;
   return SCENE.rigMath.solveIK(root,target,25,27,i?-1:1);
  });
  // Rest with the blade lowered; the committed contact still points along the
  // SIM strike. A ready pose is not a permanently aimed, horizontal firearm.
  const restAngle=Math.atan2(.8,Math.cos(m.heading)*.8),angle=action?restAngle+(wrap(action.angle-restAngle)+pose*.45)*weight:restAngle;
  function weapon(){
   const name=st.gift==='orb'?'gift_orb':'paladin_light_sword',size=st.gift==='orb'?52:100;
   if(st.gift==='orb')part(name,...arms[right].end,size,size,.5,.62,0,1,u);
   else part(name,...arms[right].end,G.tex(name).w/G.tex(name).h*size,size,.5,.825,angle+Math.PI/2,1,u);
  }
  const off=arms[1-right].end,offHandAsset=appearance.offHand==='seeing-red'?'gift_orb':prefix+'shield';
  function offhand(){
   if(offHandAsset==='gift_orb')part(offHandAsset,off[0],off[1]-5,42,42,.5,.62,0,1,u);
   else part(offHandAsset,off[0],off[1]-10,46,81,.5,.43,lean,face,u);
  }
  // The existing painted mantle belongs to the actor, not the background.
  // When travelling away from the camera the mantle covers the back, including
  // diagonal side art. Its depth must not depend on the coarse sprite view.
  // Same body transform and one layer; no second motion clock or new texture.
  function cape(){part(prefix+'cape',...body(-depth*10,-61),view==='side'?49:72,89,.5,.09,lean,face,u);}
  const capeNear=Math.sin(m.heading)<0;
  if(!capeNear)cape();
  const far=depth>=0?0:1,near=1-far;
  limb(prefix+'arm',arms[far],pins[view].arm,face,{...u,grade:[.75,1,0,1]});
  if(far===right)weapon();else offhand();
  part(prefix+'body',...body(0,-22),44+18*Math.abs(lateral),85,.5,.57,lean,face,u);
  if(capeNear)cape();
  part(prefix+'head',...head,28,32,.5,.68,lean*.5,face,u);
  if(near===right)weapon();
  limb(prefix+'arm',arms[near],pins[view].arm,face,u);
  // Shield is separate and remains in the off hand, not a second weapon actor.
  if(near!==right)offhand();
  const bladeM=M.of(M.t(...arms[right].end),M.r(angle+Math.PI/2));
  const j={ground:[a.x,a.y],groundL:[feet[0].x,feet[0].groundY],groundR:[feet[1].x,feet[1].groundY],heelL:footTrace[0].heel,heelR:footTrace[1].heel,toeL:footTrace[0].toe,toeR:footTrace[1].toe,hipL:legs[0].root,hipR:legs[1].root,tip:st.gift==='orb'?arms[right].end:M.ap(bladeM,[0,(.045-.825)*100]),shL:shoulders[0],shR:shoulders[1],head,neck,hip:root,ankleL:legs[0].end,ankleR:legs[1].end,kneeL:legs[0].joint,kneeR:legs[1].joint,footL:feet[0].target,footR:feet[1].target,
   shoulderL:shoulders[0],shoulderR:shoulders[1],elbowL:arms[0].joint,elbowR:arms[1].joint,handL:arms[0].end,handR:arms[1].end,grip:arms[right].end,
   footTargetError:Math.max(...legs.map(l=>l.reachError)),footProjectionArea:footLength,stance:feet.map(f=>f.stance),view,heading:m.heading,offHandAsset};
  for(const[k,v]of Object.entries(j))if(Array.isArray(v)&&typeof v[0]==='number')L.joint(a.id,k,v);
  return j;
 }
 function arc(e,amount){G.draw(L.P.giftArc,{u_col:[.94,.16,.10],u_angle:e.attackAngle,u_arc:e.arc,u_progress:clamp(e.phaseT/e.windup),u_mode:0,u_amt:amount},G.xf(e.x-e.reach,e.y-e.reach,e.reach*2,e.reach*2));}
 function drawEnemy(a,st,t){
  const boss=a.kind==='boss',sentinel=a.kind==='sentinel',s=boss?1.3:sentinel?1:.88,prefix='crypt_'+(boss?'boss':sentinel?'sentinel':'raider')+'_';
  const m=SCENE.pivotFrames?.get(st)?.motions[a.id]||GIFT_MOTION.update(a,t,s,st.t),face=Math.cos(m.heading)<0?-1:1,dead=a.hp<=0,fall=smooth(m.deathAge/.52),hurt=clamp(1-(st.t-a.hurtT)/.2);
  const root=[a.x+m.hipX,a.y-71*s+m.hipY+fall*48*s],u={...shade,alpha:dead?1-clamp((m.deathAge-1.8)/.65):1,tint:[1,.55,.3,hurt*.4]};
  const legs=m.feet.map((f,i)=>SCENE.rigMath.solveIK([root[0]+(i?7:-7)*s,root[1]],[f.x,f.y-9*s],31*s,34*s,face));
  for(const ik of legs){const dx=ik.end[0]-ik.root[0],dy=ik.end[1]-ik.root[1],q=((ik.joint[0]-ik.root[0])*dx+(ik.joint[1]-ik.root[1])*dy)/(dx*dx+dy*dy);ik.joint=[ik.root[0]+dx*q+(ik.joint[0]-ik.root[0]-dx*q)*.5,ik.root[1]+dy*q+(ik.joint[1]-ik.root[1]-dy*q)*.5];}
  const lp=boss?[[.37,.04],[.62,.40],[.42,.82]]:sentinel?[[.4,.04],[.63,.40],[.42,.82]]:[[.44,.04],[.68,.40],[.43,.82]];
  const footTrace=[];
  for(const ik of legs){segment(prefix+'leg',ik.joint,ik.end,lp[1][1]-.025,lp[2][1]+.02,lp[1],lp[2],face,u);segment(prefix+'leg',ik.root,ik.joint,0,lp[1][1]+.025,lp[0],lp[1],face,u);
   const tex=G.tex(prefix+'leg'),unit=9*s/(tex.h*(.97-lp[2][1])),w=tex.w*unit,h=tex.h*unit,start=lp[2][1]-.025;
   L.sprite(prefix+'leg',0,0,{m:M.of(M.t(...ik.end),M.s(face,1)),w,h:h*(1-start),src:[0,start,1,1],pivot:[lp[2][0]*w,(lp[2][1]-start)*h],u});
   footTrace.push({heel:[ik.end[0]+(.22-lp[2][0])*w*face,ik.end[1]+(.97-lp[2][1])*h],toe:[ik.end[0]+(.85-lp[2][0])*w*face,ik.end[1]+(.97-lp[2][1])*h]});
  }
  // Finish on the ground rather than holding the torso at a kneeling 60°.
  // The hands fold with the same body pose so the weapon is not left upright.
  const pose=enemyPose(a,st.t),lean=fall*1.5*face+hurt*.1*face+pose.lean*face,point=(x,y)=>M.ap(M.of(M.t(...root),M.r(lean)),[x*s,y*s]);
  const shoulders=[point(-18,-32),point(18,-32)],head=point(1,-64),hip=root;
  // Anticipation ends AT the SIM contact, then follows through and recovers.
  // The old three unrelated phase angles teleported the blade at each boundary.
  const weight=pose.weight;
  const armed=face===1?1:0,contactPoint=[a.x+Math.cos(a.attackAngle)*a.reach*.9,a.y+Math.sin(a.attackAngle)*a.reach*.9-80];
  const carry=point(33*face,-5+Math.sin(m.phase*Math.PI*2)*4*m.move),shoulder=shoulders[armed];
  const restArm=Math.atan2(carry[1]-shoulder[1],carry[0]-shoulder[0]),contactArm=Math.atan2(contactPoint[1]-shoulder[1],contactPoint[0]-shoulder[0]);
  const armAngle=restArm+(wrap(contactArm-restArm)+pose.arm*face)*weight,armReach=mix(Math.hypot(carry[0]-shoulder[0],carry[1]-shoulder[1]),pose.reach*s,weight);
  const fallenHand=point(18*face,-28),hand=[mix(shoulder[0]+Math.cos(armAngle)*armReach,fallenHand[0],fall),mix(shoulder[1]+Math.sin(armAngle)*armReach,fallenHand[1],fall)];
  const off=point(-25*face,3),hands=face===1?[off,hand]:[hand,off];
  const arms=hands.map((p,i)=>SCENE.rigMath.solveIK(shoulders[i],p,22*s,25*s,i?-1:1)),ap=boss?[[.32,.10],[.48,.47],[.77,.91]]:sentinel?[[.28,.10],[.37,.48],[.72,.90]]:[[.35,.1],[.38,.49],[.7,.91]];
  limb(prefix+'arm',arms[0],ap,face,u);part(prefix+'body',...point(0,-18),(boss?78:sentinel?64:55)*s,77*s,.5,.6,lean,face,u);part(prefix+'head',...head,34*s,38*s,.5,.6,lean*.6,face,u);
  const weapon=prefix+'weapon',tx=G.tex(weapon),height=(boss?122:sentinel?95:78)*s,w=tx.w*height/tx.h;
  const tipUV=boss?[.94,.28]:sentinel?[.46,.145]:[.47,.03],tipLocal=[(tipUV[0]-(boss?.16:.4))*w,(tipUV[1]-.81)*height];
  // Unwrap around the committed SIM direction, never around the moving wrist:
  // the latter can cross ±pi midway through a diagonal windup.
  const rest=a.attackAngle+wrap(-1.1-a.attackAngle);
  // Use the unperturbed shoulder plane for the committed arc. Recomputing it
  // from a returning wrist changed the chosen ±pi path during recovery.
  const contact=a.attackAngle+wrap(Math.atan2(contactPoint[1]-(a.y-103*s),contactPoint[0]-(a.x+(armed?18:-18)*s))-a.attackAngle),posed=contact+pose.blade*face;
  let weaponAngle=pose.recovery===undefined?mix(rest,posed,weight):mix(posed,posed+wrap(rest-posed),pose.recovery);
  weaponAngle+=wrap((face<0?Math.PI:0)-weaponAngle)*fall;
  const weaponRotation=weaponAngle-Math.atan2(tipLocal[1],tipLocal[0]);
  part(weapon,...arms[armed].end,w,height,boss?.16:.4,.81,weaponRotation,1,u);
  limb(prefix+'arm',arms[1],ap,face,u);if(sentinel)part(prefix+'cloak',...off,43*s,68*s,.5,.4,lean,face,u);
  // Trace the actual painted blade/head and boot transforms, not desired targets.
  const weaponM=M.of(M.t(...arms[armed].end),M.r(weaponRotation));
  const j={ground:[a.x,a.y],groundL:[m.feet[0].x,m.feet[0].groundY],groundR:[m.feet[1].x,m.feet[1].groundY],heelL:footTrace[0].heel,heelR:footTrace[1].heel,toeL:footTrace[0].toe,toeR:footTrace[1].toe,hipL:legs[0].root,hipR:legs[1].root,shL:shoulders[0],shR:shoulders[1],tip:M.ap(weaponM,tipLocal),target:[st.hero.x,st.hero.y-80],targetLo:[st.hero.x,st.hero.y-35],targetHi:[st.hero.x,st.hero.y-145],head,hip,kneeL:legs[0].joint,kneeR:legs[1].joint,ankleL:legs[0].end,ankleR:legs[1].end,footL:m.feet[0].target,footR:m.feet[1].target,shoulderL:shoulders[0],shoulderR:shoulders[1],elbowL:arms[0].joint,elbowR:arms[1].joint,handL:arms[0].end,handR:arms[1].end,grip:arms[armed].end,footTargetError:Math.max(...legs.map(l=>l.reachError)),stance:m.feet.map(f=>f.stance)};
  for(const[k,v]of Object.entries(j))if(Array.isArray(v)&&typeof v[0]==='number')L.joint(a.id,k,v);return j;
 }
 P.render=(st,t,quality)=>{
  const level=SIM.levelOf(st),joints={};
  L.beginBG([.025,.022,.02,1]);L.sprite(level.background,0,0,{w:1920,h:1080});L.beginComp();
  const atmosphere=window.PIVOT_ATMOSPHERE.draw(st,t,quality);
  for(const d of level.doors){const open=!d.requiresClear||st.enemies.every(e=>e.hp<=0);L.ring(d.x,d.y,34,14,open?[.83,.70,.37]:[.38,.30,.20],.35,.05);}
  for(const e of st.enemies)if(e.hp>0&&e.phase==='windup')arc(e,.6);
  L.ring(st.hero.x,st.hero.y+2,25,10,[.84,.78,.51],.32,.05);
  const players=new Map([[st.hero.id,{hero:st.hero,gift:st.gift,appearance:SIM.equipmentAppearance(st)}]]);
  for(const peer of (st.partyPeers||[]).slice(0,4))if(peer.hero?.kind==='player'&&!players.has(peer.hero.id))players.set(peer.hero.id,peer);
  for(const peer of players.values())if(peer.hero!==st.hero)L.ring(peer.hero.x,peer.hero.y+2,25,10,[.3,.75,.9],.55,.05);
  const actors=[...st.enemies.filter(e=>e.hp>0||t-e.deadT<2.5),...Array.from(players.values(),p=>p.hero)].sort((a,b)=>a.y-b.y);
  if(st.area==='camp'){actors.push(...NPCS.map(n=>({...n,npc:true,hp:100})));actors.sort((a,b)=>a.y-b.y);}
  let foregroundDraws=0;
  for(const entry of P.depthEntries(level,actors)){
   if(entry.prop){drawProp(entry.prop,level.background);foregroundDraws++;continue;}
   const a=entry.actor;L.shadow(a.x,a.y+2,24,7,a.hp>0?.48:.2);
   if(a.npc)joints['npc-'+a.id]=drawNPC(a,t);
   else if(players.has(a.id)){const p=players.get(a.id);joints[a.id]=drawPaladin(a,a===st.hero?st:{t:st.t,gift:p.gift},t,p.appearance);}
   else joints[a.id]=drawEnemy(a,st,t);
   if(!a.npc&&a!==st.hero&&a.hp>0&&a.hp<a.maxHp){L.solid(a.x-27,a.y-151,54,5,[.12,.08,.05]);L.solid(a.x-26,a.y-150,52*a.hp/a.maxHp,3,players.has(a.id)?[.2,.7,.8]:[.63,.13,.09]);}
  }
  let effects=0;
  for(const e of st.ev.slice(-16)){const age=st.t-e.t;if(age<0||age>.28||!['hit','hurt'].includes(e.k))continue;
   const col=e.k==='hurt'?[.94,.18,.13]:[1,.74,.34];
   for(let i=0;i<(quality==='low'?2:4)&&effects<32;i++,effects++){const an=i*Math.PI*.5+e.id;L.star(e.x+Math.cos(an)*(8+age*70),e.y-62+Math.sin(an)*(8+age*40),3,col,(1-age/.28)*.7);}
  }
  G.bind(null);G.blend('none');G.full(L.P.final,{u_src:L.T.comp,u_bloom:L.T.comp,u_bloom2:L.T.comp,u_t:t,u_bloomA:[0,0],u_vig:.27,u_warm:0,u_roll:.13,u_dither:0});G.blend();
  return {joints,actorCount:actors.length,playerCount:players.size,playerIds:[...players.keys()],activeEnemies:st.enemies.filter(e=>e.hp>0).length,particleCount:effects,
   area:st.area,loadedTextureMiB:Object.values(PIVOT_ASSETS).reduce((n,a)=>n+a.w*a.h*4*4/3,0)/1048576,
   renderTargetMiB:Object.values(L.T).reduce((n,a)=>n+a.w*a.h*a.bytesPerPixel,0)/1048576,
   legacyEnemyArt:false,physicalDeviceClaim:false,sceneClockSeconds:t,atmosphere,foregroundDraws};
 };
 P.drawPaladin=drawPaladin;P.drawEnemy=drawEnemy;P.pins=pins;
 const NPCS=[{id:'smith',x:419,y:376,face:-1},{id:'merchant',x:1570,y:620,face:-1}];
 function drawNPC(n,t){
  const smith=n.id==='smith',prefix='camp_'+n.id+'_',face=n.face,root=[n.x,n.y-69],q=(t+(smith?0:.8))%2.2;
  const lift=smith?(q<.8?smooth(q/.8):q<1.05?1-smooth((q-.8)/.25):0):.12+.07*Math.sin(t*.8);
  const lean=smith?-.07+.08*lift:.025*Math.sin(t*.6),p=(x,y)=>M.ap(M.of(M.t(...root),M.r(lean)),[x,y]);
  for(const side of [-1,1])part(prefix+'leg',n.x+side*9,n.y,25,74,.45,.99,0,face);
  const shoulders=[p(-18,-36),p(18,-36)],hands=[p(-35,-2-lift*34),p(31,-4-lift*8)],arms=hands.map((h,i)=>SCENE.rigMath.solveIK(shoulders[i],h,25,27,i?-1:1));
  const ap=smith?[[.30,.1],[.42,.48],[.75,.91]]:[[.38,.1],[.46,.5],[.72,.91]];
  limb(prefix+'arm',arms[1],ap,face,{...shade,grade:[.7,1,0,1]});part(prefix+'body',...p(0,-18),smith?69:59,80,.5,.61,lean,face);part(prefix+'head',...p(-1,-64),32,37,.5,.64,lean*.5,face);
  const hand=arms[0].end,tool=prefix+'tool',height=smith?44:25,w=G.tex(tool).w*height/G.tex(tool).h,angle=smith?mix(-Math.PI,-1.3,lift):-.2;
  part(tool,...hand,w,height,smith?.49:.5,smith?.85:.55,smith?angle+Math.PI/2:angle,1);limb(prefix+'arm',arms[0],ap,face,shade);
  const j={ground:[n.x,n.y],head:p(-1,-64),hip:root,handL:arms[0].end,handR:arms[1].end,elbowL:arms[0].joint,elbowR:arms[1].joint};for(const[k,v]of Object.entries(j))L.joint('npc-'+n.id,k,v);return j;
 }
 P.NPCS=NPCS;P.drawNPC=drawNPC;
})();
