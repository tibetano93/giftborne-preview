/* Render-only, world-space foot plants. No SIM writes, clocks, random or DOM.
 * One foot swings at a time. Repeated render(time) is idempotent; new actor
 * identity or time rewind starts a new cache. The renderer owns presentation. */
(function(root){
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), mix=(a,b,t)=>a+(b-a)*t;
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const cache=new WeakMap();
  const isHero=a=>a.kind==='player'||a.id==='hero';
  const HERO_RIG=Object.freeze({thigh:35,shin:49,ankleHeight:12,hipHalfWidth:8,rootHeight:90,reachInset:3,kneeProjection:.45});
  function make(a,t,s){const heading=a.aimAngle||0,vertical=Math.sin(heading),hero=isHero(a);return {time:t,x:a.x,y:a.y,heading,view:hero&&Math.abs(vertical)>.76?(vertical<0?'back':'front'):'side',face:hero?(Math.cos(heading)<0?-1:1):a.face||1,
    feet:[-1,1].map(side=>({x:a.x+side*12*s,y:a.y-4*s,groundY:a.y-4*s,lift:0,stance:true})),
    swing:null,next:0,move:0,phase:0,hipX:0,hipY:0,pelvisDrop:0,turn:0,deadAt:null,wasDodge:false};}
  function update(a,time,scale=1,simTime=time){
    let c=cache.get(a);if(!c||time<c.time||Math.hypot(a.x-c.x,a.y-c.y)>250){c=make(a,time,scale);cache.set(a,c)}
    const dt=clamp(time-c.time,0,.1),speed=Math.hypot(a.vx||0,a.vy||0);
    const dead=a.hp<=0||a.phase==='dead',dodge=!dead && a.dodgeT>=0 && simTime-a.dodgeT<.25;
    if(dead&&c.deadAt===null)c.deadAt=time;
    const moving=speed>2&&!dead&&!dodge&&(dt===0||Math.hypot(a.x-c.x,a.y-c.y)>.01), dx=moving?a.vx/speed:Math.cos(c.heading),dy=moving?a.vy/speed:Math.sin(c.heading);
    // A committed dodge keeps its own facing. Releasing the movement pointer
    // must not let stale combat aim reverse it for a single rendered frame.
    const wanted=dodge?a.dodgeAngle:moving?Math.atan2(dy,dx):Number.isFinite(a.aimAngle)?a.aimAngle:c.heading;
    if(dt>0){
      const oldFeet=c.feet.map(f=>[f.x,f.groundY]);
      if(c.wasDodge&&!dodge){for(const f of c.feet){f.stance=true;f.lift=0;f.y=f.groundY;}}
      c.wasDodge=dodge;
      const delta=wrap(wanted-c.heading),wantedVelocity=clamp(delta*12,-10,10);
      c.headingVelocity=(c.headingVelocity||0)+clamp(wantedVelocity-(c.headingVelocity||0),-dt*60,dt*60);
      const rotation=c.headingVelocity*dt;
      c.heading=wrap(c.heading+rotation);c.turn=mix(c.turn,rotation/Math.max(dt,.001),1-Math.exp(-dt*10));
      c.move=mix(c.move,moving?clamp(speed/265):0,1-Math.exp(-dt*12));
      const vertical=Math.abs(Math.sin(c.heading)), threshold=c.view==='side'?.76:.59;
      c.view=vertical>threshold?(Math.sin(c.heading)<0?'back':'front'):'side';
      if(c.view==='side'&&Math.abs(Math.cos(c.heading))>.3)c.face=Math.cos(c.heading)<0?-1:1;
      if(c.swing){
        if(!moving&&!dodge&&!dead&&!c.swing.settle){const index=c.swing.index,f=c.feet[index];c.swing={index,elapsed:0,duration:.17,from:[f.x,f.groundY],to:[a.x+(index?1:-1)*12*scale,a.y-4*scale],settle:true,startLift:f.lift,velocity:[f.vx||0,f.vy||0]};}
        const sw=c.swing,f=c.feet[sw.index];
        // Steer the airborne foot on a turn; never drag the supporting foot.
        if(moving && (sw.elapsed<sw.duration*.6||isHero(a)&&Math.abs(wrap(Math.atan2(dy,dx)-c.heading))>.35)){
          const lead=speed*(isHero(a)?Math.max(0,sw.duration-sw.elapsed-dt)+sw.duration*.5:sw.duration*.65),k=1-Math.exp(-dt*18);
          sw.to[0]=mix(sw.to[0],a.x+(sw.index?1:-1)*12*scale+dx*lead,k);
          sw.to[1]=mix(sw.to[1],a.y-4*scale+dy*lead,k);
        }
        sw.elapsed+=dt;const q=clamp(sw.elapsed/sw.duration),e=smooth(q);
        // Releasing movement must decelerate an airborne foot, not replace its
        // incoming velocity by a new zero-velocity curve in one rendered frame.
        const tangent=q*(1-q)*(1-q)*sw.duration;
        const tx=mix(sw.from[0],sw.to[0],e)+(sw.velocity?.[0]||0)*tangent,ty=mix(sw.from[1],sw.to[1],e)+(sw.velocity?.[1]||0)*tangent;
        // A capped per-frame lerp used to arrive late and stop from 12 px/frame
        // at touchdown. The planned smooth curve itself bounds acceleration.
        f.x=tx;f.groundY=ty;
        // Short projected steps cannot lift as high as a full sideward stride:
        // lift acceleration grows as height/duration^2. Keep that acceleration
        // bounded instead of raising/lowering the boot 10 px in only 6 ticks.
        const heroLift=sw.settle?5:10*Math.min(1,(sw.duration/.14)**2);
        f.lift=(isHero(a)?Math.sin(Math.PI*q)**2*heroLift:Math.sin(Math.PI*q)*(sw.settle?5:12))*scale+(sw.startLift||0)*(1-e);f.y=f.groundY-f.lift;f.stance=false;
        if(q>=1){f.stance=true;f.lift=0;f.y=f.groundY;c.next=1-sw.index;c.swing=null;c.phase+=.5;}
      }
      if(!c.swing&&!dead&&!dodge){
        const duration=moving?clamp((isHero(a)?.14-.035*Math.abs(dy):.16-.06*Math.abs(dy))*265/Math.max(100,speed),.105,.24):.17;
        // The landing is half a stance ahead of the moving pelvis. Planning
        // behind the future pelvis forced the old rig to lengthen its legs.
        const lead=moving?speed*duration*(isHero(a)?1.5:.65):0;
        let index=c.next;
        const desired=(i)=>[a.x+(i?1:-1)*12*scale+dx*lead,a.y-4*scale+dy*lead];
        const errors=c.feet.map((f,i)=>Math.hypot(f.x-desired(i)[0],f.groundY-desired(i)[1]));
        if(!moving)index=errors[0]>errors[1]?0:1;
        if(errors[index]>(moving?14:2)*scale){
          const f=c.feet[index];c.swing={index,elapsed:0,duration,from:[f.x,f.groundY],to:desired(index),settle:!moving};f.stance=false;
        }
      }
      // A dodge is a planted launch and tucked glide, never a sped-up walk cycle.
      if(dodge){
        if(!c.dodgeFrom)c.dodgeFrom=c.feet.map(f=>[f.x-c.x,f.groundY-c.y]);
        c.swing=null;const age=simTime-a.dodgeT,q=smooth(age/.08),tuck=Math.sin(Math.PI*clamp(age/.25))**2;
        for(let i=0;i<2;i++){const f=c.feet[i];f.x=a.x+mix(c.dodgeFrom[i][0],(i?1:-1)*12*scale,q);f.groundY=a.y+mix(c.dodgeFrom[i][1],-4*scale,q);f.lift=(i?8:5)*scale*tuck;f.y=f.groundY-f.lift;f.stance=false;}
      }else c.dodgeFrom=null;
      const planted=c.feet.filter(f=>f.stance),support=planted.length?planted:c.feet;
      const center=support.reduce((p,f)=>[p[0]+f.x/support.length,p[1]+f.groundY/support.length],[0,0]);
      c.hipX=mix(c.hipX,clamp((center[0]-a.x)*.17,-5*scale,5*scale),1-Math.exp(-dt*16));
      const supportArc=isHero(a)&&moving?(center[0]-a.x)**2/(2*82*scale):0;
      c.hipY=mix(c.hipY,clamp((center[1]-a.y+4*scale)*.08,-2.5*scale,2.5*scale)+supportArc+(c.swing?Math.sin(Math.PI*c.swing.elapsed/c.swing.duration)*(isHero(a)?5:2)*scale:0),1-Math.exp(-dt*16));
      if(isHero(a)){
        // A newly released rear support must not let the pelvis jump upwards.
        // The same reachable support geometry as the rig bounds its rise.
        const reach=(HERO_RIG.thigh+HERO_RIG.shin-HERO_RIG.reachInset)*scale;
        const minimum=Math.max(0,...c.feet.map((f,i)=>{
          const x=a.x+c.hipX+(i?1:-1)*HERO_RIG.hipHalfWidth*scale-f.x;
          return f.y-HERO_RIG.ankleHeight*scale-Math.sqrt(Math.max(0,reach*reach-x*x))-(a.y-HERO_RIG.rootHeight*scale+c.hipY);
        }));
        c.pelvisDrop=minimum>c.pelvisDrop?minimum:mix(c.pelvisDrop,minimum,1-Math.exp(-dt*12));
      }
      c.feet.forEach((f,i)=>{f.vx=(f.x-oldFeet[i][0])/dt;f.vy=(f.groundY-oldFeet[i][1])/dt;});
    }
    c.time=time;c.x=a.x;c.y=a.y;
    return {feet:c.feet.map(f=>({...f,target:[f.x,f.y]})),heading:c.heading,view:c.view,face:c.face,move:c.move,
      hipX:c.hipX,hipY:c.hipY+c.pelvisDrop,turn:c.turn,phase:c.phase+(c.swing?c.swing.elapsed/c.swing.duration*.5:0),
      deathAge:c.deadAt===null?0:Math.max(0,time-c.deadAt),dodge};
  }
  const api={update,reset:a=>cache.delete(a),clamp,smooth,HERO_RIG};root.GIFT_MOTION=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
