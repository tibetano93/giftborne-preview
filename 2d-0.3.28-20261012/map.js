/* Read-only cartography. SIM owns position, exits, locks and progression. */
(function(root){
 'use strict';
 const C=typeof module!=='undefined'?require('./campaign.js'):root.CAMPAIGN;
 const SIM=typeof module!=='undefined'?require('./sim.js'):root.SIM;
 const forgeIcon='<svg class="forge-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7h20l-5 6h-4v3h4v4H7v-4h3v-3H7L2 9Z"/></svg>';
 const icons={door:'⌂',forge:forgeIcon,merchant:'◇'},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function view(s){
  const level=C.AREAS[s.area],alive=s.enemies.filter(e=>e.hp>0);
  const markers=[...level.doors.map((d,i)=>({...d,name:SIM.doorName(s,d),id:'door-'+i,kind:'door',locked:!!d.requiresClear&&alive.length>0})),...(level.stations||[]).map(p=>({...p,kind:p.id,locked:false}))];
  const next=s.area==='camp'?'door-0':markers.find(m=>m.requiresClear)?.id;
  return{area:s.area,name:level.name,markers,next,alive:alive.map(e=>({id:e.id,x:e.x,y:e.y})),hero:{x:s.hero.x,y:s.hero.y,heading:Math.hypot(s.hero.vx,s.hero.vy)>2?Math.atan2(s.hero.vy,s.hero.vx):s.hero.aimAngle||0},completed:!!s.completed,
  objective:SIM.objective(s)+(s.area==='camp'&&s.expedition?.returned?'. Снаряжение и таланты сохранятся; стражи вернутся при новом спуске.':'')};
 }
 function worldExit(model,destination){const to=destination==='camp'?'camp':model.area==='camp'?'crypt':model.area==='crypt'?'boss':'crypt',direct=model.markers.find(m=>m.to===to);
  // The sealed reward exit is not the only way home: retreat through the crypt.
  return direct?.locked&&model.area==='boss'&&destination==='camp'?model.markers.find(m=>m.to==='crypt'):direct;
 }
 // Bounded, presentation-only route through the same walkable footprint as SIM.
 // No straight line across water, path-follow command, or topology mutation.
 function route(level,start,end,radius=17){
  const valid=p=>C.walkable(level,p.x,p.y,radius);
  const clear=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/8);for(let i=0;i<=n;i++){const t=n?i/n:0;if(!valid({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}))return false;}return true;};
  if(!valid(start)||!valid(end))return[];if(clear(start,end))return[{...start},{...end}];
  const step=40,nx=49,ny=28,nodes=new Map();
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const p={x:x*step,y:y*step};if(valid(p))nodes.set(y*nx+x,p);}
  const queue=[],parent=new Map();for(const [id,p]of nodes)if(Math.hypot(p.x-start.x,p.y-start.y)<=step*1.5&&clear(start,p)){queue.push(id);parent.set(id,null);}
  let finish=null;for(let i=0;i<queue.length;i++){const id=queue[i],p=nodes.get(id);if(Math.hypot(p.x-end.x,p.y-end.y)<=step*1.5&&clear(p,end)){finish=id;break;}
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=id%nx+dx,y=Math.floor(id/nx)+dy,j=y*nx+x;if(x<0||x>=nx||y<0||y>=ny||parent.has(j)||!nodes.has(j)||!clear(p,nodes.get(j)))continue;parent.set(j,id);queue.push(j);}
  }
  if(finish===null)return[];const raw=[{...end}];for(let i=finish;i!==null;i=parent.get(i))raw.push(nodes.get(i));raw.push({...start});raw.reverse();
  const result=[raw[0]];for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&!clear(raw[i],raw[j]))j--;result.push(raw[j]);i=j;}return result;
 }
 function projection(w,h,W,H,zoom=1,pan={x:0,y:0},focus=null){const b=focus||{x:0,y:0,w:W,h:H},scale=Math.min(Math.max(1,w-64)/b.w,Math.max(1,h-88)/b.h)*clamp(zoom,1,2),sw=W*scale,sh=H*scale;
  const limit=(v,view,size)=>size>view?clamp(v,view-size,0):(view-size)/2;
  return{scale,x:limit(w/2-(b.x+b.w/2)*scale+pan.x,w,sw),y:limit((h-20)/2-(b.y+b.h/2)*scale+pan.y,h,sh)};}
 function mount({state,close}){
  const panel=document.createElement('dialog');panel.id='map-panel';panel.setAttribute('aria-labelledby','map-title');
  panel.innerHTML=`<header class="map-header"><h2 id="map-title">Земли Каменного Брода</h2><nav aria-label="Вид карты"><button id="map-world" aria-pressed="true">Мир</button><button id="map-area" aria-pressed="false">Область</button></nav><button id="map-close" aria-label="Закрыть карту">×</button></header><div class="map-content"><section class="map-chart"><div id="map-viewport" aria-label="Карта с отметками"><img id="map-image" alt=""><svg id="map-route" aria-hidden="true"><polyline/></svg><div id="map-markers"></div><span id="map-player" aria-label="Ваш герой">➤</span><span id="map-place"></span></div><div class="map-tools"><span id="map-caption"></span><button id="map-minus" aria-label="Уменьшить карту">−</button><button id="map-plus" aria-label="Увеличить карту">+</button><button id="map-center" aria-label="Вернуться к ориентирам">⤢</button></div></section><aside class="map-detail"><h3 id="map-selection"></h3><img id="map-preview" alt=""><p id="map-description"></p><p id="map-objective"></p><button id="map-guide">Показать путь</button><small id="map-guidance" role="status"></small></aside></div><footer class="map-legend" aria-label="Легенда карты"><span><b class="legend-player">➤</b>Вы</span><span><b>⌂</b>Переход</span><span><b>${forgeIcon}</b>Кузница</span><span><b>◇</b>Снабжение</span><span><b class="legend-enemy">×</b>Враг</span><span><b>⊗</b>Закрыто</span></footer>`;
  document.getElementById('game').append(panel);const $=id=>panel.querySelector('#'+id),viewport=$('map-viewport'),image=$('map-image'),svg=$('map-route'),markers=$('map-markers');
  let model,mode='world',selected='crypt',zoom=1,pan={x:0,y:0},drag=null,path=[],opened=false;
  const assets=['world','camp','crypt','boss'].map(n=>{const i=new Image();i.src='assets/pivot/map_'+n+'.webp';return i;});
  const worldNodes=[{id:'camp',name:'Каменный Брод',x:180,y:548,kind:'camp'},{id:'crypt',name:'Затопленный склеп',x:998,y:300,kind:'door'}];
  const worldCurrent=()=>model.area==='camp'?'camp':'crypt';
  function selection(){return mode==='area'?model.markers.find(m=>m.id===selected):worldNodes.find(n=>n.id===selected);}
  function worldDoor(){return worldExit(model,selected);}
  function details(){const p=selection();$('map-selection').textContent=p?.name||model.name;const area=mode==='area'?model.area:selected;$('map-preview').src='assets/pivot/map_'+area+'.webp';
   $('map-objective').textContent=model.objective;let d=p;
   if(mode==='world'){const here=selected===worldCurrent();d=here?null:worldDoor();$('map-description').textContent=here?(model.area==='boss'?'Вы в зале Хранителя, внутри склепа.':'Вы в этой области.'):(selected==='camp'?'Безопасный лагерь · кузница и снабжение.':'Подземелье · стражи и зал Хранителя.');$('map-guide').textContent=here?'Текущая область':'Путь к переходу';$('map-guide').disabled=!!d?.locked||(!here&&!d);}
   else{$('map-description').textContent=p?.locked?'Проход закрыт, пока живы стражи.':p?.kind==='forge'?'Смените пробный Gift и подготовьтесь к бою.':p?.kind==='merchant'?'Восстановите здоровье, ману и запас зелий.':'Доступный переход. Подойдите и взаимодействуйте.';$('map-guide').textContent='Показать путь';$('map-guide').disabled=!p||p.locked;}
   if(d?.locked)$('map-description').textContent='Проход закрыт, пока живы стражи.';
  }
  function layout(){if(!opened)return;const W=mode==='world'?1184:1920,H=mode==='world'?824:1080,r=viewport.getBoundingClientRect(),points=mode==='world'?worldNodes:[...model.markers,model.hero,...model.alive,...path],xs=points.map(p=>p.x),ys=points.map(p=>p.y),focus={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(1,Math.max(...xs)-Math.min(...xs)),h:Math.max(1,Math.max(...ys)-Math.min(...ys))},origin=projection(r.width,r.height,W,H,zoom,{x:0,y:0},focus),p=projection(r.width,r.height,W,H,zoom,pan,focus);pan={x:p.x-origin.x,y:p.y-origin.y};
   for(const e of [image,svg]){Object.assign(e.style,{left:p.x+'px',top:p.y+'px',width:W*p.scale+'px',height:H*p.scale+'px'});}svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.querySelector('polyline').setAttribute('points',path.map(v=>v.x+','+v.y).join(' '));
   for(const b of markers.children){const x=p.x+Number(b.dataset.x)*p.scale;b.style.left=x+'px';b.style.top=(p.y+Number(b.dataset.y)*p.scale)+'px';const label=b.querySelector('span');if(label){label.style.transform='none';label.style.left=(clamp(x-label.offsetWidth/2,4,r.width-label.offsetWidth-4)-x+22)+'px';}}
   const hero=mode==='world'?worldNodes.find(n=>n.id===worldCurrent()):model.hero,player=$('map-player');player.style.left=(p.x+hero.x*p.scale)+'px';player.style.top=(p.y+hero.y*p.scale)+'px';player.hidden=mode==='world';player.style.transform=`translate(-50%,-50%) rotate(${model.hero.heading}rad)`;
   $('map-place').textContent=mode==='world'?'Область героя: '+model.name:'';$('map-minus').disabled=zoom===1;$('map-plus').disabled=zoom===2;
  }
  function render(){model=view(state());const list=mode==='world'?worldNodes:model.markers;markers.replaceChildren();
   image.src='assets/pivot/map_'+(mode==='world'?'world':model.area)+'.webp';
   for(const p of list){const b=document.createElement('button');b.type='button';b.className='map-marker '+p.kind+(p.locked?' locked':'');b.dataset.id=p.id;b.dataset.x=p.x;b.dataset.y=p.y;b.setAttribute('aria-pressed',String(p.id===selected));b.setAttribute('aria-label',p.name+(p.locked?' · закрыто':''));b.title=b.getAttribute('aria-label');b.innerHTML=`<b>${p.locked?'⊗':icons[p.kind]||'⌂'}</b><span></span>`;b.querySelector('span').textContent=p.name;b.onclick=()=>{selected=p.id;path=[];$('map-guidance').textContent='';render();};markers.append(b);}
   if(mode==='area')for(const e of model.alive){const dot=document.createElement('i');dot.className='map-enemy';dot.dataset.x=e.x;dot.dataset.y=e.y;dot.setAttribute('aria-label','Живой враг');dot.textContent='×';markers.append(dot);}
   $('map-world').setAttribute('aria-pressed',String(mode==='world'));$('map-area').setAttribute('aria-pressed',String(mode==='area'));$('map-caption').textContent=mode==='world'?'Обзор земель · не маршрут движения':model.name+' · точное положение';panel.dataset.mode=mode;details();layout();
  }
  function switchMode(next){mode=next;model=view(state());selected=mode==='world'?worldCurrent():model.next;zoom=1;pan={x:0,y:0};path=[];$('map-guidance').textContent='';render();}
  $('map-world').onclick=()=>switchMode('world');$('map-area').onclick=()=>switchMode('area');$('map-close').onclick=close;
  $('map-guide').onclick=()=>{if(mode==='world'){const here=selected===worldCurrent(),door=worldDoor();switchMode('area');if(!here&&door)selected=door.id;render();}
   const p=selection();if(!p||p.locked)return;path=route(C.AREAS[model.area],model.hero,p,state().hero.radius);$('map-guidance').textContent=path.length?'Линия показывает дорогу. Двигайтесь сами.':'Безопасный путь не найден. Выберите другой ориентир.';layout();};
  $('map-plus').onclick=()=>{zoom=clamp(zoom+.5,1,2);layout();};$('map-minus').onclick=()=>{zoom=clamp(zoom-.5,1,2);layout();};$('map-center').onclick=()=>{zoom=1;pan={x:0,y:0};layout();};
  viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:{...pan}};viewport.setPointerCapture(e.pointerId);});
  viewport.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;pan={x:drag.pan.x+e.clientX-drag.x,y:drag.pan.y+e.clientY-drag.y};layout();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(ev,e=>{if(drag?.id===e.pointerId)drag=null;});
  panel.addEventListener('cancel',e=>{e.preventDefault();close();});panel.addEventListener('keydown',e=>{if(e.code==='Escape')e.stopPropagation();});new ResizeObserver(()=>{drag=null;layout();}).observe(viewport);
  return{ready:()=>Promise.all(assets.map(i=>i.decode())),open(){if(opened)return;opened=true;model=view(state());mode='world';selected=model.area==='camp'?'crypt':worldCurrent();zoom=1;pan={x:0,y:0};path=[];$('map-guidance').textContent='';panel.showModal();render();$('map-close').focus();},hide(){opened=false;drag=null;path=[];$('map-guidance').textContent='';panel.close();},visible:()=>opened};
 }
 const api={view,route,projection,worldExit,mount};root.MAP_UI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
