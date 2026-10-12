/* Presentation of SIM-owned actions and milestone talents. No combat mutations. */
(function(root){
 'use strict';
 function view(s,sim){const g=sim.getBuild(s),t=sim.talentState(s),K=sim.K;
  return{gift:s.gift,...t,actions:[
   {id:'attack',name:'Обычный удар',image:'gift_'+s.gift+'.png',description:'Направленный удар. Нужны дистанция, верное направление и свободная линия до врага.',damage:g.damage,cost:0,cooldown:K.attackCooldown,contact:K.attackContact,extra:'Контакт решает симуляция; промах не наносит урон.'},
   {id:'dodge',name:'Рывок',image:'skill_fortitude.png',description:'Движение в сторону джойстика; без ввода — по направлению героя. Не проходит сквозь стены.',cost:0,cooldown:K.dodgeCooldown,extra:'Неуязвимость '+K.invulnerability+' с; затем можно получить урон.'},
   {id:'gift',name:g.skillName,image:'gift_'+s.gift+'.png',description:g.description,cost:g.skillCost,damage:g.skillDamage,cooldown:g.skillCooldown,contact:K.skillContact,extra:s.gift==='orb'?'Круговой контакт и отталкивание. Босс не оглушается.':'Сектор перед героем. Враг вне сектора не получает урон.'}
  ],talents:Object.entries(sim.TALENTS).map(([id,d])=>({id,...d,rank:t.picks.includes(id)?1:0,image:'skill_'+id+'.png'}))};
 }
 function mount({container,state,sim,command}){
  container.innerHTML=`<div class="skills-summary"><strong>Паладин · <span id="skills-points"></span></strong><span id="skills-milestones"></span></div><div class="skills-layout"><figure class="skill-portrait"><img src="assets/pivot/skills_portrait.png" alt="Иллюстрация паладина"><figcaption>Иллюстрация класса<br>Gift — в узлах справа</figcaption></figure><section class="skills-tree" aria-label="Умения и таланты"><div class="skill-path">Клинок</div><div class="skill-path">Оплот</div><div class="skill-path">Ауры</div><div id="skills-actions"></div><div class="skills-tree-divider">ТАЛАНТЫ · ВЫБОР РАЗВИТИЯ</div><div id="skills-talents"></div></section><article class="skills-detail"><div class="skills-detail-heading"><img id="skills-icon" alt=""><div><small id="skills-kind"></small><h3 id="skills-name"></h3></div></div><p id="skills-description"></p><dl id="skills-stats"></dl><p id="skills-extra"></p><div class="skills-buttons"><button id="skills-learn">Изучить · 1 очко</button><button id="skills-reset" title="Вернуть все очки в лагере">Сбросить</button></div></article></div><p id="skills-status" role="status"></p>`;
  const $=id=>container.querySelector('#'+id);let selected='gift',revision=0,message='';
  const preloads=['skills_portrait','skill_mastery','skill_fortitude','skill_will'].map(n=>{const i=new Image();i.src='assets/pivot/'+n+'.png';return i;});
  function select(id){selected=id;message='';render();}
  function render(){const s=state(),v=view(s,sim);revision=v.revision;
   $('skills-points').textContent='Очки: '+v.available+' / '+v.earned;
   $('skills-milestones').textContent=(v.cryptClear?'✓':'○')+' Склеп: +1  ·  '+(v.returned?'✓':'○')+' Печать: +1';
   for(const [id,entries,talent]of [['skills-actions',v.actions,false],['skills-talents',v.talents,true]]){
    $(id).replaceChildren();for(const d of entries){const b=document.createElement('button');b.id='node-'+d.id;b.dataset[talent?'talent':'ability']=d.id;b.setAttribute('aria-pressed',String(selected===d.id));b.setAttribute('aria-label',d.name+(talent?', ранг '+d.rank+' из 1':''));const img=new Image();img.src='assets/pivot/'+d.image;img.alt='';const label=document.createElement('span');label.textContent=talent?d.name:{attack:'Удар',dodge:'Рывок',gift:'Сила дара'}[d.id];const rank=document.createElement('b');rank.textContent=talent?d.rank+'/1':'Умение';b.append(img,label,rank);b.onclick=()=>select(d.id);$(id).append(b);}
   }
   const d=[...v.actions,...v.talents].find(d=>d.id===selected)||v.actions[2],talent=Object.hasOwn(sim.TALENTS,d.id);
   $('skills-icon').src='assets/pivot/'+d.image;$('skills-kind').textContent=talent?'ПАССИВНЫЙ ТАЛАНТ':'АКТИВНОЕ УМЕНИЕ';$('skills-name').textContent=d.name;$('skills-description').textContent=d.description;
   const stats=talent?[['Ранг',d.rank+' / 1'],['Стоимость',d.rank?'Изучено':'1 очко']]:[['Урон',d.damage??'—'],['Мана',d.cost],['Перезарядка',d.cooldown+' с']];
   $('skills-stats').replaceChildren();for(const [label,value]of stats){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);$('skills-stats').append(row);}
   $('skills-extra').textContent=talent?(d.rank?'Действует с любым экипированным Gift.':v.available?'Выберите улучшение перед следующим боем.':'Очко за первую зачистку склепа; ещё одно — за первый возврат печати.'):(d.contact?'Контакт через '+d.contact+' с. ':'')+d.extra;
   $('skills-learn').hidden=!talent;$('skills-learn').disabled=!!d.rank||v.available===0;$('skills-learn').textContent=d.rank?'Изучено':'Изучить · 1 очко';
   $('skills-reset').hidden=!talent||!v.picks.length;$('skills-reset').disabled=s.area!=='camp';$('skills-reset').textContent=s.area==='camp'?'Сбросить':'Только лагерь';
   $('skills-status').textContent=message||(s.talentsRecovered?'Повреждённое развитие восстановлено; прохождение сохранено.':v.returned?'Таланты сохраняются в новых вылазках. Новые очки за повторное прохождение не выдаются.':'Gifts: DEV-пример, владение не проверено. Улучшения действуют в этом локальном эпизоде.');
  }
  function act(kind){const r=command({kind,id:selected,revision});message=r.ok?(kind==='reset'?'Очки возвращены. Здоровье, мана и прогресс не изменены.':r.changed?'Талант изучен. Эффект уже действует.':'Талант уже изучен.'):{combat:'Завершите бой и действие героя перед выбором.',stale:'Развитие изменилось. Выберите талант заново.',points:'Сначала получите очко за этап пути.',camp:'Перераспределение доступно в лагере.'}[r.reason]||'Изменение отклонено.';render();}
  $('skills-learn').onclick=()=>act('learn');$('skills-reset').onclick=()=>act('reset');
  return{ready:()=>Promise.all(preloads.map(i=>i.decode())),open(){selected='gift';message='';render();},render};
 }
 const api={view,mount};root.SKILLS_UI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
