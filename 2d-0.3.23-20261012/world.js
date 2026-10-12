/* Stoneford's layered scenery, shared wind, local light and one weather story.
 * Presentation only: weather cannot change combat, rewards or saved ownership. */
(function(root){
 'use strict';
 const W=1920,H=1080,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
 let previous=null,last=0,rain=0,cloud=0,wet=0,dusk=0,reduced=false;
 const shaders={
  worldGrade:`uniform sampler2D u_tex; uniform float u_cloud,u_dusk,u_foreground;
uniform vec2 u_actor0,u_actor1,u_actor2,u_actor3;
float actorClear(vec2 p,vec2 a){vec2 q=(p-(a-vec2(0.,80.)))/vec2(92.,148.);return 1.-smoothstep(.55,1.,length(q));}
void main(){vec2 p=v_uv*vec2(1920.,1080.); vec3 rgb=texture(u_tex,v_uv).rgb;
float cloudShape=vnoise(p*.0022+vec2(u_t*.018,-u_t*.009));
float shade=1.-u_cloud*(.12+.24*cloudShape);
rgb*=vec3(1.-u_dusk*.12,1.-u_dusk*.045,1.+u_dusk*.045)*shade;
float leftEdge=520.+p.x*.64;float rightEdge=530.+(1920.-p.x)*.68;
float mask=max((1.-smoothstep(750.,850.,p.x))*smoothstep(leftEdge-2.,leftEdge+1.,p.y),smoothstep(1160.,1300.,p.x)*smoothstep(rightEdge-2.,rightEdge+1.,p.y));
float protection=max(max(actorClear(p,u_actor0),actorClear(p,u_actor1)),max(actorClear(p,u_actor2),actorClear(p,u_actor3)));
float a=u_foreground>.5?mask*(1.-protection*.94):1.;o=vec4(rgb*a,a);}`,
  worldFlame:`uniform vec3 u_col;uniform float u_wind,u_amt;
void main(){vec2 p=v_uv;float h=1.-p.y;float edge=sin(u_t*4.6+h*8.)*.065*h+sin(u_t*9.1+h*17.)*.025;
float x=(p.x-.5-u_wind*h*.17+edge)/(max(.035,.42*(1.-h)));float n=vnoise(vec2(p.x*8.+u_t*.4,p.y*8.+u_t*3.));
float a=(1.-smoothstep(.35,1.,abs(x)))*smoothstep(0.,.15,p.y)*(.65+.35*n)*u_amt;
vec3 col=mix(u_col,vec3(1.,.91,.53),pow(p.y,2.));o=vec4(col*a,a*.8);}`,
  worldWet:`uniform float u_amt,u_wind;
void main(){vec2 p=v_px;float floorMask=smoothstep(420.,500.,p.y)*(1.-smoothstep(1020.,1080.,p.y))*smoothstep(150.,250.,p.x)*(1.-smoothstep(1710.,1830.,p.x));
float n=vnoise(vec2(p.x*.012,p.y*.023));float puddle=smoothstep(.57,.76,n)*floorMask;
float reflection=exp(-dot((p-vec2(1480.,750.))/vec2(210.,180.),(p-vec2(1480.,750.))/vec2(210.,180.)));
float fire=exp(-dot((p-vec2(460.,550.))/vec2(240.,95.),(p-vec2(460.,550.))/vec2(240.,95.)));
vec2 cell=floor(p/vec2(72.,39.));float seed=hash(cell);vec2 q=fract(p/vec2(72.,39.))-.5;float age=fract(u_t*(1.2+seed)+seed*17.);
float ring=(1.-smoothstep(.018,.045,abs(length(q)-age*.46)))*(1.-age)*step(.6,seed)*u_amt;
float shimmer=.8+.2*sin(p.y*.17+u_t*3.+u_wind);
vec3 col=vec3(.1,.17,.19)+vec3(.15,.52,.49)*reflection*shimmer+vec3(.49,.24,.07)*fire;
float a=puddle*u_amt*.32; o=vec4(col*a+vec3(.38,.53,.55)*ring*floorMask*u_amt*.2,a+ring*floorMask*u_amt*.14);}`,
  worldRain:`uniform float u_amt,u_wind,u_low;
void main(){vec2 p=v_px;p.x-=p.y*u_wind*.15;vec2 grid=vec2(31.,100.);vec2 cell=floor(p/grid);float seed=hash(cell);
float y=fract(p.y/grid.y+u_t*(3.4+seed*2.)+seed*7.);float x=fract(p.x/grid.x);
float line=(1.-smoothstep(.012,.046,abs(x-(.12+seed*.74))))*smoothstep(.52,.7,y)*(1.-smoothstep(.92,1.,y));
float a=line*u_amt*(.12+seed*.15)*step(u_low>.5?.55:.2,seed);o=vec4(vec3(.61,.77,.83)*a,a);}`
 };
 function update(st,t){
  if(previous!==st||t<last){previous=st;last=t;rain=cloud=wet=dusk=0;}
  const dt=clamp(t-last,0,.1);last=t;
  const boss=st.enemies.find(e=>e.kind==='boss');
  const progress=st.phase==='ready'?0:smooth((st.t-9)/19);
  const storm=st.phase==='won'?0:Math.max(progress,boss?.engaged? .9:0);
  const desiredCloud=st.phase==='won'?.08:storm;
  cloud+=(desiredCloud-cloud)*(1-Math.exp(-dt*.32));
  const desiredRain=smooth((cloud-.4)/.48)*.86;
  rain+=(desiredRain-rain)*(1-Math.exp(-dt*.48));
  wet+=(rain-wet)*(1-Math.exp(-dt*(rain>wet?.22:.035)));
  const desiredDusk=st.phase==='won'?.15:clamp(st.t/70)*.8;
  dusk+=(desiredDusk-dusk)*(1-Math.exp(-dt*.25));
  return {t,rain,cloud,wet,dusk,wind:(.25+cloud*.6)*(reduced?.25:1),reduced,phase:rain>.35?'rain':cloud>.3?'wind':'clear'};
 }
 function windAt(x,t,w){return (Math.sin(t*.85-x*.003)+.38*Math.sin(t*1.7-x*.0014))*w.wind;}
 function lighting(x,y,w){
  const fire=Math.exp(-(((x-380)/360)**2)-((y-390)/290)**2),rune=Math.exp(-(((x-1550)/360)**2)-((y-500)/280)**2);
  return {fire,rune,tint:[1+fire*.36-rune*.14-w.dusk*.12,1+fire*.12+rune*.11,1-fire*.16+rune*.23+w.dusk*.09],
   brightness:1.03-w.cloud*.13,rim:fire>rune?[1,.66,.29]:[.35,.92,.91],shadowX:(x-(fire>rune?380:1550))*.025*(fire+rune)};
 }
 function backdrop(w,foreground=false,actors=[]){const u={u_tex:G.tex('backdrop'),u_t:w.t,u_cloud:w.cloud,u_dusk:w.dusk,u_foreground:foreground?1:0};for(let i=0;i<4;i++)u['u_actor'+i]=actors[i]?[actors[i].x,actors[i].y]:[-1000,-1000];G.draw(LIB.P.worldGrade,u,G.xf(0,0,W,H));}
 const grass=[{x:440,y:862,w:125,h:78},{x:655,y:975,w:152,h:91},{x:1090,y:929,w:120,h:73},{x:1605,y:702,w:109,h:68},{x:1575,y:905,w:140,h:88}];
 function plant(name,x,y,width,height,w,mode=1,hero=null,flip=false){
  const gust=windAt(x,w.t,w),push=hero?clamp((95-Math.hypot(hero.x-x,hero.y-y))/95)*Math.sign(x-hero.x)*.16:0;
  LIB.sprite(name,x,y,{w:width,h:height,flip,pad:.05,u:{grade:[.9,.93-w.cloud*.12,0,1.03],sway:[.007+w.wind*.012,4,w.t*.95-x*.003,mode],lean:[gust*.038+push,mode===1?0:1]}});
 }
 function background(w){
  plant('env_branch',-145,45,430,290,w,3);
  plant('env_ivy',960,16,205,180,w,2);
  plant('env_ivy',1640,115,160,180,w,2);
  plant('env_banner',827,91,82,171,w,2);
  for(const f of [[383,144,68,72],[731,219,30,53],[1424,278,26,46],[1628,320,27,44]]){
   const cold=f[0]>1000;G.draw(LIB.P.worldFlame,{u_t:w.t+(cold?2:0),u_col:cold?[.15,.85,.79]:[1,.32,.035],u_wind:windAt(f[0],w.t,w),u_amt:cold?.68:.83},G.xf(f[0]-f[2]/2,f[1]-f[3]/2,f[2],f[3]));
  }
  for(let i=0;i<4;i++){const q=(w.t*.12+i*.25)%1;LIB.puff(400+q*37+windAt(400,w.t,w)*q*35,132-q*117,16+q*28,[.15,.18,.18],Math.sin(Math.PI*q)*.15,i+3);}
 }
 function ground(w,low){if(w.wet>.01&&!LIB.NOFX)G.draw(LIB.P.worldWet,{u_t:w.t,u_amt:w.wet,u_wind:windAt(900,w.t,w)},G.xf(0,0,W,H));}
 function foreground(w,st,low){
  // Fade scenery locally around actors when they move behind a wall. Keep
  // every playable corner readable instead of hiding a valid character.
  backdrop(w,true,[st.hero,...st.enemies]);
  plant('env_branch',1690,795,300,210,w,3,null,true);
  if(!LIB.NOFX){
   const count=low?5:10;
   for(let i=0;i<count;i++){const life=(w.t*(.028+i*.0007)+i*.133)%1;
    const x=(i*227+life*300+windAt(i*220,w.t,w)*32)%1920,y=170+life*880;
    if(!w.reduced)LIB.solid(x,y,5+i%3,2,[.46,.43,.22],w.t*1.7+i,2,1,Math.sin(Math.PI*life)*.55);
   }
   if(w.rain>.005&&!w.reduced)G.draw(LIB.P.worldRain,{u_t:w.t,u_amt:w.rain,u_wind:windAt(950,w.t,w),u_low:low?1:0},G.xf(0,0,W,H));
  }
 }
 const api={shaders,update,windAt,lighting,backdrop,background,ground,foreground,grass,plant,setReducedMotion:v=>{reduced=!!v}};root.GIFT_WORLD=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
