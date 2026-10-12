/* Short local-episode guide; never a second hero/progression authority. */
(function(root){
 'use strict';
 const KEY='giftborne-2d-intro-v1';
 const pages=[
  {title:'Огонь ещё горит',kicker:'ВАШ ГЕРОЙ',copy:'Вы — паладин Каменного Брода. Подготовьтесь в лагере и верните печать Хранителя из склепа.',art:'menu_scene.png',note:'Одиночное приключение · прогресс сохраняется на этом устройстве'},
  {title:'Читайте бой, выбирайте момент',kicker:'ИССЛЕДОВАНИЕ И БОЙ',copy:'Джойстик слева ведёт героя. Справа — удар, сила дара и рывок. Уходите из красного сектора до удара; зелья восстанавливают здоровье.',art:'pivot_crypt.webp',note:'Начните с кузнеца и торговца, затем идите к мосту'},
  {title:'Соберите свой боевой набор',kicker:'СНАРЯЖЕНИЕ',copy:'Откройте снаряжение, меняйте вещи и развивайте таланты. Меч бьёт направленной дугой, шар выпускает кольцо энергии.',art:'menu_scene.png',item:'gift_sword.png',note:'В этом эпизоде доступны пробные Gifts · без покупки'},
  {title:'Дар с собственной историей',kicker:'TELEGRAM GIFTS',copy:'Пробуйте силу Light Sword и Crystal Ball. Собственные Telegram Gifts пока не подключены — статус доступен в меню «Герой → Мои Gifts».',art:'pivot_camp.webp',item:'gift_orb.png',note:'Вы играете пробным набором. Совместная игра и PvP пока недоступны.'}
 ];
 function create({storage,onChange=()=>{},onFinish=()=>{}}){
  let done=false,opened=false,step=0,persisted=true;
  try{const v=JSON.parse(storage.getItem(KEY)||'null');done=!!v&&v.version===1&&v.done===true&&Object.keys(v).length===2;}catch{}
  const snapshot=()=>({done,opened,step,persisted,total:pages.length});
  return{snapshot,open(){opened=true;step=0;onChange();},back(){if(opened){step=Math.max(0,step-1);onChange();}},next(){if(!opened)return;if(step<pages.length-1){step++;onChange();}else this.finish();},close(){opened=false;onChange();},finish(){if(!opened)return;done=true;opened=false;try{storage.setItem(KEY,JSON.stringify({version:1,done:true}));}catch{persisted=false;}onChange();onFinish();}};
 }
 function mount({parent,play,home}){
  parent.insertAdjacentHTML('beforeend',`<section id="welcome" hidden aria-labelledby="welcome-title" aria-describedby="welcome-copy"><div class="welcome-art" aria-hidden="true"></div><div class="welcome-vignette" aria-hidden="true"></div><header><img src="assets/pivot/menu_title.png" alt="Giftborne"><button id="welcome-skip">Пропустить</button></header><div class="welcome-content"><span id="welcome-kicker"></span><h2 id="welcome-title" tabindex="-1"></h2><p id="welcome-copy"></p><p id="welcome-note"></p></div><img id="welcome-item" hidden alt=""><footer><button id="welcome-back">Назад</button><div id="welcome-progress" aria-live="polite"></div><button id="welcome-next">Далее</button></footer></section>`);
  const $=id=>parent.querySelector('#'+id),panel=$('welcome'),siblings=[...parent.children].filter(e=>e!==panel),blocked=new Map();
  const controller=create({storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},onFinish:play,onChange:render});
  function render(){const v=controller.snapshot();panel.hidden=!v.opened;if(!v.opened){for(const[e,inert]of blocked)e.inert=inert;blocked.clear();return;}for(const e of siblings){if(!blocked.has(e))blocked.set(e,e.inert);e.inert=true;}
   const page=pages[v.step];panel.dataset.step=String(v.step);panel.querySelector('.welcome-art').style.backgroundImage=`url("assets/pivot/${page.art}")`;$('welcome-kicker').textContent=page.kicker;$('welcome-title').textContent=page.title;$('welcome-copy').textContent=page.copy;$('welcome-note').textContent=page.note;$('welcome-item').hidden=!page.item;if(page.item)$('welcome-item').src='assets/pivot/'+page.item;$('welcome-back').disabled=v.step===0;$('welcome-next').textContent=v.step===pages.length-1?'Играть':'Далее';$('welcome-progress').innerHTML=pages.map((_,i)=>`<span class="${i===v.step?'current':''}" aria-hidden="true"></span>`).join('')+`<small>${v.step+1} / ${pages.length}</small>`;$('welcome-title').focus();
  }
  $('welcome-back').onclick=()=>controller.back();$('welcome-next').onclick=()=>controller.next();$('welcome-skip').onclick=()=>controller.finish();
  panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();controller.close();home();}if(e.key==='Tab'){const buttons=[...panel.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('welcome-title'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  return{open:()=>controller.open(),firstPlay(){if(controller.snapshot().done)play();else controller.open();},visible:()=>controller.snapshot().opened};
 }
 root.ONBOARDING={KEY,pages,create,mount};if(typeof module!=='undefined')module.exports=root.ONBOARDING;
})(typeof window!=='undefined'?window:globalThis);
