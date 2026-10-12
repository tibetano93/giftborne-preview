/* Painted environment animation. Pure time sampling, no SIM changes, particles,
 * textures, render targets or accumulated emitters. Coordinates refer to the
 * selected 1672x941 plates; actors and combat are composited AFTER these patches. */
(function(root){
 'use strict';
 const SIZE=[1672,941],SCALE=[1920/SIZE[0],1080/SIZE[1]],CAP=24;
 const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
 const patch=(kind,points,seed=0)=>({kind,points,seed});
 const fire=(x,y,w=42,h=64)=>patch('fire',rect(x-w/2,y-h*.75,w,h),x*.13);
 const lamp=(x,y,w,h)=>({...fire(x,y,w,h),kind:'lamp'});
 const haze=(x,y,w,h,seed)=>patch('haze',rect(x,y,w,h),seed);
 const profiles={
  camp:[
   patch('water',[[814,7],[855,10],[1060,77],[1036,89],[873,52],[814,36]],1),
   patch('water',[[988,92],[1090,108],[1192,122],[1090,181],[995,148]],2),
   patch('water',[[1280,208],[1358,174],[1460,191],[1656,245],[1656,270],[1510,230],[1384,216]],3),
   fire(248,184,55,54),fire(161,291),lamp(962,130,26,32),fire(1488,404,50,46),lamp(1403,607,26,36),
   patch('banner',[[471,80],[516,82],[510,169],[490,185],[477,168]],5),
   patch('banner',[[427,692],[467,674],[464,791],[443,821],[424,799]],7),
   patch('foliage',[[18,435],[108,413],[185,456],[184,520],[79,542],[18,501]],11)
  ],
  crypt:[
   patch('water',[[208,300],[382,230],[470,212],[606,155],[634,190],[377,305],[242,358],[183,337]],1),
   patch('water',[[16,553],[280,430],[354,408],[364,434],[185,525],[83,590],[16,620]],2),
   patch('water',[[575,339],[710,282],[757,268],[750,300],[693,354],[622,375]],3),
   patch('water',[[1290,684],[1360,658],[1430,684],[1485,707],[1390,735],[1290,694]],4),
   patch('water',[[963,817],[1000,790],[1145,850],[1240,903],[1265,934],[1182,934],[1080,889],[970,841]],5),
   patch('fall',rect(49,435,48,115),13),
   fire(414,544,50,66),fire(600,449,30,58),fire(831,252,46,62),fire(1167,54,30,60),fire(1330,95,30,62),fire(1557,163,32,64),fire(1198,737,34,64),fire(1155,668,26,46),
   haze(190,478,138,62,9),haze(1195,836,115,70,12)
  ],
  boss:[fire(52,303,50,75),fire(476,80,56,75),fire(1205,83,54,74),fire(1550,205,54,78),fire(322,665,30,50),haze(575,136,160,50,15),haze(1050,140,170,52,19)]
 };
 // Compile once. Bounded polygon masks have a feathered inside edge; structural
 // masonry, bridge and dry gameplay floor are never displaced by water flow.
 const modes={water:0,fire:1,lamp:1,banner:2,foliage:2,fall:3,haze:4};
 const prepared={};
 for(const [area,list]of Object.entries(profiles)){
  if(list.length>CAP)throw Error('Atmosphere patch cap exceeded');
  prepared[area]=list.map(p=>{
   const xs=p.points.map(v=>v[0]),ys=p.points.map(v=>v[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
   const points=new Float32Array(16);for(let i=0;i<8;i++)points.set(p.points[Math.min(i,p.points.length-1)],i*2);
   return{...p,xf:[w*SCALE[0],0,0,0,h*SCALE[1],0,x*SCALE[0],y*SCALE[1],1],
    u:{u_plate:SIZE,u_box:[x,y,w,h],u_points:points,u_count:p.points.length,u_mode:modes[p.kind],u_seed:p.seed,u_banner:p.kind==='banner'?1:0,u_static:p.kind==='lamp'?1:0,u_motion:1,u_t:0}};
  });
 }
 const SHADER=`
uniform sampler2D u_tex; uniform vec2 u_plate, u_points[8];
uniform vec4 u_box; uniform int u_count; uniform float u_mode,u_seed,u_motion,u_banner,u_static;
float maskAt(vec2 p){float d=10000.;bool inside=false;for(int i=0;i<8;i++){if(i>=u_count)break;int j=i+1;if(j>=u_count)j=0;vec2 a=u_points[i],b=u_points[j],v=b-a;d=min(d,length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.001),0.,1.)));if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}return inside?smoothstep(0.,7.,d):0.;}
void main(){
 vec2 p=u_box.xy+v_uv*u_box.zw,uv=p/u_plate;
 vec4 base=texture(u_tex,uv);float m=maskAt(p),t=u_t;vec2 drift=vec2(0.);vec3 col=base.rgb;
 if(u_mode<.5){
  // Same painted surface, not a second reflected scene. Flow never crosses the mask.
  float a=sin(p.x*.052+p.y*.107-t*2.9+u_seed),b=sin(p.x*.021-p.y*.193+t*2.03);
  drift=vec2(a*1.6,b*.95)*u_motion*m;
  col=texture(u_tex,(p+drift)/u_plate).rgb*(1.+u_motion*.065*a*b);
 }else if(u_mode<1.5){
  // Only the existing warm flame pixels move; iron, walls and lantern fixtures stay put.
  float radial=1.-smoothstep(.3,1.,length((v_uv-.5)*2.));
  float hot=smoothstep(.55,.9,base.r)*smoothstep(.15,.35,base.r-base.b);
  // Tight authored flame core, not the larger glow rectangle: warm masonry,
  // brass hoods and tent fabric must never inherit the flame's deformation.
  float free=1.-smoothstep(.4,1.,length((v_uv-vec2(.5,.75))/vec2(.28,.23)));
  drift=vec2(sin(t*8.3+v_uv.y*12.+u_seed)*2.5,sin(t*6.7+u_seed)*1.8)*free*u_motion*(1.-u_static);
  vec3 flame=texture(u_tex,(p+drift)/u_plate).rgb;
  col=mix(base.rgb,flame,hot*free)+vec3(1.,.37,.06)*(.045+.035*sin(t*7.1+u_seed)*u_motion)*hot*free;
  m*=radial;
 }else if(u_mode<2.5){
  // Shared travelling wind field: cloth and foliage sample the same spatial phase.
  float wind=sin(t*.73-p.x*.004)+.4*sin(t*1.17-p.x*.007);
  float free=smoothstep(.08,.88,v_uv.y);
  float selected=u_banner>.5?smoothstep(.025,.08,base.r-base.g):smoothstep(.012,.07,base.g-base.b);
  drift=vec2(wind*2.2,sin(t*1.43+p.y*.05)*.55)*free*u_motion*m*selected;
  col=texture(u_tex,(p+drift)/u_plate).rgb;
 }else if(u_mode<3.5){
  float water=smoothstep(.09,.21,min(base.g,base.b));
  float stream=sin(p.y*.4-t*13.+sin(p.x*.47));
  drift=vec2(sin(t*3.+p.y*.18)*.6,stream*2.)*u_motion*m;
  col=texture(u_tex,(p+drift)/u_plate).rgb*(1.+stream*.17*u_motion*water);
 }else{
  // Low, local vapour over the wet channel / far boss wall. Never over actors.
  float edge=1.-smoothstep(.3,1.,length((v_uv-.5)*2.));
  float n=vnoise(p*vec2(.025,.06)+vec2(-t*.36,t*.07)+u_seed);
  m*=edge*smoothstep(.32,.84,n)*.28;
  col=vec3(.25,.29,.29);
 }
 o=vec4(col*m,m);
}`;
 let reduced=false;
 const api={CAP,profiles,shaders:{pivotAtmosphere:SHADER},setReducedMotion:value=>{reduced=!!value;},
  draw(st,time,quality){
   const list=prepared[st.area]||[],disabled=!!root.LIB?.NOFX||!!st.atmosphereOff,low=quality==='low',motion=reduced?0:1;
   let count=0;
   if(!disabled)for(const p of list){
    // Transient QA fixture selector; not serialized by SIM or used in gameplay.
    if(st.atmosphereOnly&&st.atmosphereOnly!==p.kind)continue;
    if((low||reduced)&&['haze','banner','foliage'].includes(p.kind))continue;
    p.u.u_tex=root.G.tex('pivot_'+st.area);p.u.u_t=reduced?0:time;p.u.u_motion=motion;
    root.G.draw(root.LIB.P.pivotAtmosphere,p.u,p.xf);count++;
   }
   return{area:st.area,patchCount:count,patchCap:CAP,motionScale:disabled?0:motion,reducedMotion:reduced,clockSeconds:reduced?0:time,particles:0,newTextureMiB:0,newTargetMiB:0,extraFullscreenPasses:0,rain:false};
  }
 };
 root.PIVOT_ATMOSPHERE=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
