(async function(){
 'use strict';
 await import('./party-client.js');
 const requestAnimationFrame=new URLSearchParams(location.search).has('render')?()=>{}:window.requestAnimationFrame.bind(window);
 const $=id=>document.getElementById(id),canvas=$('world'),keys=new Set(),held={act:false,skill:false,dodge:false},actionPointers={act:null,skill:null,dodge:null},queued={act:false,skill:false,dodge:false,interact:false,potion:false,resupply:false};
 const legacy=new URLSearchParams(location.search).has('legacy'),saveKey='giftborne-2d-campaign-v1';
 let equipmentPanel=null,menuPanel=null,mapPanel=null,settingsPanel=null,merchantPanel=null,combatAudio=null,giftProfile=null,saveFailed=false,saveReadFailed=false,saveFailureDismissed=false,resumeAfterSave=false,partyClient=null,partyCurrent=null,partyCanRevalidate=null,partyRevalidate=null,partyResuming=null,partyResumeEpoch=0,soloState=null;
 const saveChoicePresses=new Set();
 const preferenceStore=PREFERENCES.create({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)}),motionPreference=matchMedia('(prefers-reduced-motion: reduce)'),audioSupported=typeof(window.AudioContext||window.webkitAudioContext)==='function',voices=new Map();
 function readSave(){try{const data=JSON.parse(localStorage.getItem(saveKey)||'null');saveReadFailed=false;return data;}catch{saveReadFailed=true;return null;}}
 let state=legacy?SIM.create({gift:'sword'}):SIM.restore(readSave()),selected=state?.gift||'sword',ready=false,last=0,acc=0,paused=false,stick={mx:0,my:0},stickId=null,moveTarget=null,aim=null,quality='balanced',audioOn=false,audioCtx=null,audioMaster=null,audioPlayed=0,lastEvent=0,frames=0,frameTime=0,fps=0,startedAt=0,savedStep=-1;
 if(!legacy){
  document.body.classList.add('pivot');const css=document.createElement('link');css.rel='stylesheet';css.href='pivot.css';document.head.append(css);const skillsCss=document.createElement('link');skillsCss.rel='stylesheet';skillsCss.href='skills.css';document.head.append(skillsCss);const merchantCss=document.createElement('link');merchantCss.rel='stylesheet';merchantCss.href='merchant.css';document.head.append(merchantCss);
  $('game').insertAdjacentHTML('beforeend',`<section id="globe-hud" class="globe-hud" hidden aria-label="Состояние героя"><div class="globe"><div id="life-fill" class="globe-fill"></div><span class="globe-title">ЗДОРОВЬЕ</span><span class="globe-label" id="life-value"></span></div><div class="belt"><button id="potion" aria-label="Выпить зелье здоровья"><span class="bottle"></span><span id="potions"></span></button><button id="equipment" aria-label="Экипировка"><img src="assets/pivot/gift_sword.png" alt="Light Sword"></button><button id="map-open" aria-label="Карта">Карта</button></div><div class="globe mana"><div id="mana-fill" class="globe-fill"></div><span class="globe-title">МАНА</span><span class="globe-label" id="mana-value"></span></div></section><button id="interact" hidden>Взаимодействовать</button>`);
  document.querySelector('.brand small').id='area-label';
  for(const globe of document.querySelectorAll('.globe')){const well=document.createElement('div');well.className='globe-well';while(globe.firstChild)well.append(globe.firstChild);globe.append(well);}
  document.querySelector('.intro h1').innerHTML='За переправой<br><em>горит древний свет</em>';
  document.querySelector('.intro p').textContent='Вы — паладин Каменного Брода. Перейдите мост, войдите в затопленный склеп и верните печать Хранителя.';
  document.querySelector('.quest .eyebrow').textContent='ПЕЧАТЬ ХРАНИТЕЛЯ';
  document.querySelector('.build-label').firstChild.textContent='2D 0.3.30-dev · НОВОЕ НАПРАВЛЕНИЕ · ПРОТОТИП';
  for(const b of document.querySelectorAll('[data-gift]')){const id=b.dataset.gift;b.querySelector('.gift-icon').innerHTML=`<img src="assets/pivot/gift_${id}.png" alt="">`;b.querySelector('b').textContent=id==='sword'?'Light Sword · Absinthe':'Crystal Ball · Seeing Red';b.classList.toggle('selected',id===selected);}
  $('potion').onclick=()=>{if(!paused)queued.potion=true;};$('interact').onclick=()=>{if(!paused)queued.interact=true;};$('equipment').onclick=openEquipment;
  $('equipment').insertAdjacentHTML('beforeend','<span id="talent-points" hidden></span>');
  equipmentPanel=EQUIPMENT_UI.mount({state:()=>state,sim:SIM,talentCommand:c=>{const r=SIM.talentCommand(state,c);if(r.ok&&r.changed){clearInput();save();}return r;},command:c=>{const r=SIM.inventoryCommand(state,c);if(r.ok&&r.changed){selected=state.gift;save();}return r;},close:closeEquipment});
  // Secondary touch pointers do not reliably synthesize a click while the
  // primary finger owns the movement stick. Keyboard/mouse retain onclick.
  $('equipment').addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();openEquipment();}});
  $('game').insertAdjacentHTML('beforeend',`<section id="station-panel" class="panel center" hidden aria-label="Мастерская лагеря"><div class="eyebrow" id="station-kicker">КАМЕННЫЙ БРОД</div><h2 id="station-title"></h2><p id="station-copy"></p><div id="forge-gifts" class="gift-choice"><button id="equip-sword" class="gift-card"><img src="assets/pivot/gift_sword.png" width="48" height="48" alt=""><b>Light Sword</b><small></small></button><button id="equip-orb" class="gift-card"><img src="assets/pivot/gift_orb.png" width="48" height="48" alt=""><b>Crystal Ball</b><small></small></button></div><button id="resupply" class="primary">Восстановиться и пополнить пояс</button><button id="station-close" class="primary">Вернуться к пути</button><small class="disclosure">Локальный эпизод: Gifts не подтверждены владением. Никаких покупок.</small></section>`);
  merchantPanel=MERCHANT_UI.mount({container:$('station-panel'),state:()=>state,sim:SIM,inventory:INVENTORY,close:closeStation,saved:()=>!saveFailed,retrySave:save,command:c=>{const r=SIM.tradeCommand(state,c);if(r.ok&&r.changed){clearInput();save();}return r;}});$('station-close').onclick=closeStation;$('resupply').onclick=()=>{closeStation();queued.resupply=true;};
  for(const id of ['sword','orb'])$('equip-'+id).onclick=()=>{if(SIM.equip(state,id)){selected=id;$('station-copy').textContent=id==='sword'?'Экипирован Light Sword · Absinthe':'Экипирован Crystal Ball · Seeing Red';$('equipment').querySelector('img').src='assets/pivot/gift_'+id+'.png';save();}};
  const mapCss=document.createElement('link');mapCss.rel='stylesheet';mapCss.href='map.css';document.head.append(mapCss);
  mapPanel=MAP_UI.mount({state:()=>state,close:closeMap});bindTouchActivation($('map-open'),openMap);
  const settingsCss=document.createElement('link');settingsCss.rel='stylesheet';settingsCss.href='settings.css';document.head.append(settingsCss);
  settingsPanel=SETTINGS_UI.mount({value:()=>preferenceStore.value,apply:applyPreferences,close:closeSettings,systemReduced:()=>motionPreference.matches,audioSupported:()=>audioSupported,testSound:async()=>{await unlockAudio();tone(500,.15,.02);}});
  const menuCss=document.createElement('link');menuCss.rel='stylesheet';menuCss.href='menu.css';document.head.append(menuCss);
  giftProfile=GIFT_PROFILE.create({configuration:window.GIFTBORNE_PROFILE_CONFIG,readInitData:GIFT_PROFILE.readTelegramInitData,onChange:profileChanged});
  menuPanel=MENU_UI.mount({state:()=>state,sim:SIM,continueGame:start,equipment:()=>{clearInput();equipmentPanel.open();},settings:openSettings,giftProfile,joinParty:(mode='party')=>{const session=giftProfile.createPartySession(mode);return session?joinParty(session):false;}});menuPanel.open();
  $('pause-panel').insertAdjacentHTML('beforeend','<button id="return-menu" class="primary">Главное меню</button>');$('return-menu').onclick=openMenu;
  bindTouchActivation($('return-menu'),openMenu);
  $('pause-panel').insertAdjacentHTML('beforeend','<button id="pause-settings" class="primary">Настройки</button>');bindTouchActivation($('pause-settings'),openSettings);
  $('pause-panel').insertAdjacentHTML('afterbegin','<section id="save-warning" hidden><p>Прогресс не сохранён. Перезагрузка потеряет последние изменения.</p><button id="save-retry">Повторить сохранение</button></section>');
  $('game').insertAdjacentHTML('beforeend',`<dialog id="save-error" aria-labelledby="save-error-title" aria-describedby="save-error-copy"><h2 id="save-error-title">Прогресс не сохранён</h2><p id="save-error-copy">Браузер не смог записать изменения. Не закрывайте и не перезагружайте игру. Герой и предметы пока остаются в этой сессии.</p><p id="save-error-status" role="status"></p><button id="save-error-retry">Повторить сохранение</button><button id="save-error-continue">Продолжить без сохранения</button></dialog>`);
  bindSaveChoice('save-error-retry',()=>{if(saveReadFailed)return retryReadSave();if(!save())$('save-error-status').textContent='Хранилище всё ещё недоступно. Последние изменения не записаны.';});
  bindSaveChoice('save-error-continue',()=>{if(saveReadFailed)return;saveFailureDismissed=true;closeSaveFailure();});
  $('save-error').addEventListener('cancel',e=>{e.preventDefault();});
  $('save-error').addEventListener('keydown',e=>e.stopPropagation());
  $('save-retry').onclick=()=>{if(!save())showSaveFailure(true);else $('resume').focus();};
 }
 function openSettings(){if(!settingsPanel||!ready||settingsPanel.visible())return;setPause(true);clearInput();$('pause-panel').hidden=true;settingsPanel.open();}
 function closeSettings(){settingsPanel?.hide();clearInput();if(menuPanel?.visible())$('menu-settings').focus();else setPause(true);}
 function applyPreferences(value){const result=preferenceStore.apply(value);clearInput();syncPreferences();return result;}
 function syncPreferences(){const v=PREFERENCES.effective(preferenceStore.value,motionPreference.matches);quality=v.quality;audioOn=v.audioEnabled;SCENE.setQuality(quality);GIFT_WORLD.setReducedMotion(v.reduceMotion);PIVOT_ATMOSPHERE.setReducedMotion(v.reduceMotion);document.body.classList.toggle('preferences-hide-hints',!v.hints);$('quality').textContent=quality==='low'?'ECO':'HD';$('quality').disabled=motionPreference.matches;$('quality').setAttribute('aria-label',motionPreference.matches?'Системное уменьшение движения: ECO':quality==='low'?'Качество: экономное':'Качество: высокое');$('sound').disabled=!audioSupported;$('sound').textContent=audioOn?'♫':'♪';$('sound').setAttribute('aria-label',audioOn?'Выключить звук':'Включить звук');if(!audioOn||v.volume===0)stopVoices();if(audioMaster)audioMaster.gain.value=audioOn?v.volume/100:0;}
 function openMap(){if(partyClient||!ready||state.phase!=='playing'||mapPanel?.visible()||menuPanel?.visible())return;setPause(true);$('pause-panel').hidden=true;mapPanel.open();save();}
 function closeMap(){if($('save-error')?.open)return;mapPanel?.hide();setPause(false);$('map-open')?.focus();}
 function openStation(id){$('station-panel').classList.toggle('merchant-mode',id==='merchant');if(id==='merchant')merchantPanel.open();for(const gift of ['sword','orb'])$('equip-'+gift).querySelector('small').textContent=SIM.getBuild(state,gift).damage+' урона · '+(gift==='sword'?'направленный удар':'круговая сила');clearInput();stopVoices();paused=true;state.paused=true;$('pause-panel').hidden=true;$('station-panel').hidden=false;$('station-title').textContent=id==='forge'?'У кузнечного огня':'Снабжение перед дорогой';$('station-copy').textContent=id==='forge'?'Смените пробный Gift перед спуском. У каждого — своя сила в бою.':'Отдых восстанавливает здоровье и ману бесплатно. Зелья и обычные вещи — за игровое золото.';$('forge-gifts').hidden=id!=='forge';$('resupply').hidden=id!=='merchant';$('station-kicker').textContent=id==='forge'?'КУЗНЕЦ · ОРМ':'КВАРТИРМЕЙСТЕР · ВЕРА';}
 function closeStation(){if($('station-panel'))$('station-panel').hidden=true;paused=false;state.paused=false;clearInput();last=performance.now();acc=0;unlockAudio();}
 function openEquipment(){if(partyClient||!ready||state.phase!=='playing'||equipmentPanel?.visible())return;setPause(true);$('pause-panel').hidden=true;equipmentPanel.open();}
 function closeEquipment(){if($('save-error')?.open)return;equipmentPanel?.hide();if(menuPanel?.visible()){menuPanel.refresh();$('profile-equipment').focus();clearInput();}else setPause(false);}
 function openMenu(){if(partyClient)return leaveParty();if(!menuPanel||!ready)return;setPause(true);clearInput();save();$('pause-panel').hidden=true;menuPanel.open();}
 function updateSaveWarning(){if(!$('save-warning'))return;$('save-warning').hidden=!saveFailed;$('pause').classList.toggle('save-failed',saveFailed);}
 function bindSaveChoice(id,activate){const b=$(id);
  b.addEventListener('pointerdown',()=>saveChoicePresses.add(id));b.addEventListener('pointercancel',()=>saveChoicePresses.delete(id));
  b.onclick=e=>{const own=saveChoicePresses.delete(id);if(e.detail>0&&!own)return;activate();};
 }
 function closeSaveFailure(){const panel=$('save-error');if(!panel?.open)return;panel.close();clearInput();
  if(resumeAfterSave&&!document.hidden&&state.phase==='playing'){paused=false;state.paused=false;last=performance.now();acc=0;}
  resumeAfterSave=false;
 }
 function retryReadSave(){const data=readSave();if(saveReadFailed){$('save-error-status').textContent='Чтение всё ещё недоступно. Старое сохранение не изменено.';return;}
  state=SIM.restore(data);selected=state.gift;savedStep=state.steps;lastEvent=state.eventId;clearInput();closeSaveFailure();menuPanel?.refresh();sync();
 }
 function showSaveFailure(force=false){const panel=$('save-error');if(!panel||panel.open||document.hidden||(!force&&!saveReadFailed&&saveFailureDismissed))return;
  // The merchant already owns a visible warning/retry next to its transaction.
  // Keep that existing path; every other surface gets the same paused warning.
  if(!force&&!$('station-panel').hidden&&$('station-panel').classList.contains('merchant-mode'))return;
  resumeAfterSave=!paused&&state.phase==='playing';clearInput();stopVoices();paused=true;state.paused=true;last=performance.now();acc=0;
  // A dialog opened on another control's pointerdown must not consume that
  // gesture's synthesized click as consent to continue without saving.
  $('save-error-title').textContent=saveReadFailed?'Сохранение недоступно':'Прогресс не сохранён';
  $('save-error-copy').textContent=saveReadFailed?'Не удалось прочитать прохождение. Оно не будет заменено новой игрой. Повторите загрузку, когда хранилище станет доступно.':'Браузер не смог записать изменения. Не закрывайте и не перезагружайте игру. Герой и предметы пока остаются в этой сессии.';
  $('save-error-retry').textContent=saveReadFailed?'Повторить загрузку':'Повторить сохранение';$('save-error-continue').hidden=saveReadFailed;
  saveChoicePresses.clear();$('save-error-status').textContent='';panel.showModal();$('save-error-retry').focus();
 }
 function save(){if(saveReadFailed){showSaveFailure();return false;}if(!state.campaign||state.partyMember)return true;savedStep=state.steps;try{localStorage.setItem(saveKey,JSON.stringify(SIM.snapshot(state)));saveFailed=false;saveFailureDismissed=false;updateSaveWarning();closeSaveFailure();return true;}catch{saveFailed=true;updateSaveWarning();showSaveFailure();return false;}}
 let visualTime=0,terminalAt=null;
 Object.defineProperty(window,'__ready',{get:()=>ready,configurable:true});
 const game={get party(){return partyClient?.snapshot()||null},joinParty,leaveParty,get giftProfile(){return giftProfile?.snapshot()||null},get preferences(){return preferenceStore.value},get audioDiagnostics(){return{supported:audioSupported,enabled:audioOn,volume:preferenceStore.value.volume,gain:audioMaster?.gain.value??0,voices:voices.size,played:audioPlayed,context:audioCtx?.state||'locked',combat:combatAudio?.diagnostics||{ready:false,scheduled:0,history:[]}}},get visualTime(){return visualTime},get state(){return state},get ready(){return ready},get paused(){return paused},get quality(){return quality},get diagnostics(){return {...SCENE.diagnostics,fps}},input:held,start,reset:()=>reset(false)};window.GIFTBORNE=game;
 // Release-owned room capability and the private selected-profile broker.
 // No ticket, identity or endpoint is accepted from URL/localStorage.
 function profileChanged(){if(partyClient&&partyCurrent&&!partyCurrent()){partyClient.suspend();partyChanged(partyClient.snapshot().status);}menuPanel?.refresh();}
 async function joinParty({url,issueTicket,current=null,canRevalidate=null,revalidate=null}){
  if(legacy||!ready||partyClient||current&&!current()||!save())return false;
  const networkState=SIM.create({campaign:true,gift:selected});
  const client=PARTY_CLIENT.create({state:networkState,url,issueTicket,onChange:partyChanged,onSnapshot:({first,areaChanged,eventId})=>{if(first||areaChanged){lastEvent=eventId;visualTime=networkState.t;}if(areaChanged){clearInput();stopVoices();acc=0;$('result').hidden=true;$('controls').hidden=paused||networkState.phase!=='playing';}if(networkState.phase==='playing')terminalAt=null;}});
  soloState=state;clearInput();stopVoices();state=networkState;partyClient=client;partyCurrent=current;partyCanRevalidate=canRevalidate;partyRevalidate=revalidate;state.partyMember='connecting';
  menuPanel?.hide();equipmentPanel?.hide();mapPanel?.hide();settingsPanel?.hide();if($('station-panel'))$('station-panel').hidden=true;
  $('intro').hidden=true;$('result').hidden=true;return resumeParty();
 }
 function partyChanged(status){
  if(!partyClient)return;
  if(status!=='connected'){clearInput();stopVoices();paused=true;state.paused=true;acc=0;$('controls').hidden=true;$('pause-panel').hidden=false;}
  const connecting=status==='connecting'||partyResuming===partyClient,unconfirmed=partyCurrent&&!partyCurrent(),changed=unconfirmed&&!(partyRevalidate&&partyCanRevalidate?.());$('pause-panel').querySelector('h2').textContent=changed?'Данные героя изменились':connecting?'Проверяем подключение':status==='connected'?'Общий бой':'Связь с боем прервана';
  $('pause-panel').querySelector(':scope > p').textContent=changed?(giftProfile?.snapshot().account.status==='reopen'?'Для входа в отряд откройте Mini App заново: нужна свежая сессия героя. Сейчас можно вернуться к одиночному прохождению.':'Вернитесь в главное меню и обновите героя перед входом в отряд. Одиночное прохождение сохранено.'):connecting?'Управление остановлено до ответа сервера.':unconfirmed?'После возврата проверим героя и подключимся к тому же бою. Общий мир не стоит на паузе.':'Общий мир не стоит на паузе. Подключитесь снова или вернитесь к одиночному прохождению.';
  $('resume').textContent='Подключиться снова';$('resume').disabled=connecting||changed;$('restart-paused').hidden=true;
 }
 async function resumeParty(){
  const own=partyClient;if(!own||partyResuming===own||document.hidden)return false;const attempt=++partyResumeEpoch,currentAttempt=()=>partyClient===own&&attempt===partyResumeEpoch&&!document.hidden;partyResuming=own;clearInput();
  try{
  if(partyCurrent&&!partyCurrent()){
   if(!partyRevalidate||!partyCanRevalidate?.()){own.suspend();partyChanged(own.snapshot().status);return false;}
   // External pause/blur also cancels the read-only phase before connect owns
   // its socket epoch. Internal profile read notifications do not cancel it.
   partyChanged('connecting');if(!await partyRevalidate()||!currentAttempt()||!partyCurrent()){own.suspend();return false;}
  }
  const ok=await own.connect();if(!currentAttempt()){own.suspend();return false;}
  if(ok&&own.snapshot().status==='connected'&&!document.hidden){paused=false;state.paused=false;$('pause-panel').hidden=true;$('hud').hidden=false;$('controls').hidden=state.phase!=='playing';last=performance.now();acc=0;sync();unlockAudio();return true;}
  if(ok)own.suspend();return false;
  }finally{if(partyResuming===own)partyResuming=null;if(partyClient===own&&own.snapshot().status!=='connected')partyChanged(own.snapshot().status);}
 }
 function leaveParty(){
  if(!partyClient)return false;++partyResumeEpoch;const old=partyClient;partyClient=null;partyCurrent=partyCanRevalidate=partyRevalidate=null;old.dispose();clearInput();stopVoices();
  state=soloState;soloState=null;state.paused=true;paused=true;selected=state.gift;lastEvent=state.eventId;visualTime=state.t;terminalAt=null;acc=0;savedStep=state.steps;
  $('pause-panel').querySelector('h2').textContent='Тишина перед боем';$('pause-panel').querySelector(':scope > p').textContent='Игра на паузе.';
  $('resume').textContent='Продолжить путь';$('resume').disabled=false;$('restart-paused').hidden=false;$('change-gift').hidden=false;
  $('result').hidden=true;$('pause-panel').hidden=true;$('controls').hidden=true;sync();menuPanel?.open();return true;
 }
 if(new URLSearchParams(location.search).has('render'))game.renderForQA=()=>{SCENE.state=state;SCENE.render(state.t);framing();sync();};
 // Keep landscape composition wide; portrait follows the hero horizontally.
 // Input uses the identical object-fit transform, never a second camera.
 function framing(){const r=canvas.getBoundingClientRect();if(innerHeight>innerWidth){const scale=Math.max(r.width/1920,r.height/1080),overflow=1920*scale-r.width;const shift=overflow>0?Math.max(0,Math.min(1,(state.hero.x*scale-r.width/2)/overflow)):.5;canvas.style.objectPosition=(shift*100)+'% center'}else canvas.style.objectPosition='center'}
 function point(e){const r=canvas.getBoundingClientRect(),cover=!legacy||innerHeight>innerWidth,scale=cover?Math.max(r.width/1920,r.height/1080):Math.min(r.width/1920,r.height/1080),w=1920*scale,h=1080*scale;let x=(r.width-w)/2;if(cover){const pos=parseFloat(canvas.style.objectPosition);x=(r.width-w)*(Number.isFinite(pos)?pos:50)/100}return{x:(e.clientX-r.left-x)/scale,y:(e.clientY-r.top-(r.height-h)/2)/scale}}
 function clearInput(){SCENE.target=null;keys.clear();Object.keys(held).forEach(k=>{held[k]=false;actionPointers[k]=null;});Object.keys(queued).forEach(k=>queued[k]=false);stick={mx:0,my:0};stickId=null;$('stick').style.transform='';moveTarget=null;aim=null;if(state.inputLatch)state.inputLatch={};}
 function setPause(v){if(partyClient){if(v){++partyResumeEpoch;partyClient.suspend();partyChanged(partyClient.snapshot().status);}else resumeParty();return;}if(!v&&$('save-error')?.open){clearInput();return;}settingsPanel?.hide();if(v){stopVoices();resumeAfterSave=false;}if(menuPanel?.visible()){clearInput();return;}if(!ready||state.phase!=='playing')return;equipmentPanel?.hide();mapPanel?.hide();if($('station-panel'))$('station-panel').hidden=true;paused=v;state.paused=v;clearInput();$('pause-panel').hidden=!v;$('pause').setAttribute('aria-label',v?'Продолжить':'Пауза');last=performance.now();acc=0;if(!v)unlockAudio()}
 function reset(toIntro){if(partyClient)return leaveParty();visualTime=0;terminalAt=null;clearInput();menuPanel?.hide();equipmentPanel?.hide();mapPanel?.hide();settingsPanel?.hide();if($('station-panel'))$('station-panel').hidden=true;paused=false;state=legacy?(toIntro?SIM.create({gift:selected}):SIM.restart(selected)):SIM.create({campaign:true,gift:selected});if(!toIntro)SIM.start(state);lastEvent=0;document.getElementById('pause').setAttribute('aria-label','Пауза');startedAt=performance.now();$('intro').hidden=!toIntro;$('hud').hidden=toIntro;$('controls').hidden=toIntro;$('hint').hidden=toIntro;$('result').hidden=true;$('pause-panel').hidden=true;if(toIntro)menuPanel?.open();last=performance.now();acc=0;save();sync()}
 function start(){if(partyClient)return resumeParty();if(!ready)return;if(saveReadFailed){showSaveFailure();return;}if(legacy)return reset(false);menuPanel?.hide();clearInput();paused=false;state.paused=false;SIM.start(state);$('pause').setAttribute('aria-label','Пауза');$('pause-panel').hidden=true;$('intro').hidden=true;$('hud').hidden=false;$('controls').hidden=false;$('hint').hidden=false;last=performance.now();acc=0;sync();unlockAudio()}
 function retryEpisode(editEquipment=false){if(partyClient){if(state.duelMember&&state.phase==='ready'){clearInput();return partyClient.ready(!state.duelReady);}if(state.partyJourney?.stage===1&&state.partyStory&&state.phase==='won'){clearInput();return partyClient.input({interact:true});}return leaveParty();}if(!['lost','won'].includes(state.phase))return;if(!state.campaign)return reset(false);if(!SIM.recover(state))return;clearInput();terminalAt=null;$('result').hidden=true;start();if(editEquipment===true)openEquipment();save();}
 function changeGiftAfterResult(){if(!['lost','won'].includes(state.phase))return;if(state.campaign&&state.phase==='lost')retryEpisode(true);else if(!state.campaign)reset(true);}
 function unlockAudio(){if(audioOn&&audioSupported){try{if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();audioMaster=audioCtx.createGain();const compressor=audioCtx.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=6;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.12;const headroom=audioCtx.createGain();headroom.gain.value=.75;audioMaster.connect(compressor).connect(headroom).connect(audioCtx.destination);combatAudio=COMBAT_AUDIO.create({context:audioCtx,master:audioMaster,voices,canPlay:()=>audioOn&&preferenceStore.value.volume>0&&!document.hidden&&!paused,onPlayed:()=>audioPlayed++});}audioMaster.gain.value=preferenceStore.value.volume/100;return Promise.all([audioCtx.resume(),combatAudio.load()]).catch(()=>{});}catch{stopVoices();}}}
 function stopVoices(){for(const [o,dispose]of voices){try{o.stop();}catch{}dispose();}}
 function tone(freq,dur,vol,type='sine'){if(!audioOn||!audioCtx||audioCtx.state!=='running'||preferenceStore.value.volume===0||voices.size>=12||document.hidden)return;const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.5),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(audioMaster);const dispose=()=>{o.onended=null;voices.delete(o);o.disconnect();g.disconnect();};voices.set(o,dispose);audioPlayed++;o.onended=dispose;o.start(t);o.stop(t+dur)}
 function sync(){const h=state.hero;$('health').style.width=Math.max(0,h.hp/h.maxHp*100)+'%';$('hp-label').textContent=Math.ceil(h.hp)+' / '+h.maxHp;$('gift-label').textContent=SIM.getGift(state.gift).name;$('count').textContent=state.kills+' / 3';$('objective').textContent=state.rewardReady?'Вернитесь к хранилищу':'Одолейте стражей';$('skill-cd').textContent=h.skillCooldown>.05?Math.ceil(h.skillCooldown):'';$('skill').setAttribute('aria-label',SIM.getGift(state.gift).skillName);$('skill').style.opacity=h.skillCooldown>.05?'.75':'1';$('dodge').style.opacity=h.dodgeCooldown>.05?'.55':'1';
  $('hint').textContent=state.rewardReady?'Стражи пали. Подойдите к светящемуся знаку у хранилища.':state.t<12?'WASD или джойстик — движение. J — удар, K — сила дара.':'Уходите из красного сектора. Рывок даёт короткую неуязвимость.';
  if(state.campaign){
   const level=SIM.levelOf(state),i=SIM.interaction(state);$('area-label').textContent=level.name.toUpperCase();
   const points=partyClient?0:SIM.talentState(state).available;$('talent-points').hidden=points===0;$('talent-points').textContent=points;$('equipment').setAttribute('aria-label',points?'Снаряжение · нераспределённых очков: '+points:'Снаряжение');
   const equipped=$('equipment').querySelector('img');if(equipped.dataset.gift!==state.gift){equipped.dataset.gift=state.gift;equipped.src='assets/pivot/gift_'+state.gift+'.png';equipped.alt=state.gift==='orb'?'Crystal Ball · Seeing Red':'Light Sword · Absinthe';}
   $('globe-hud').hidden=state.phase==='ready';$('life-fill').style.height=(h.hp/h.maxHp*100)+'%';$('mana-fill').style.height=(h.mana/h.maxMana*100)+'%';
   $('life-value').textContent=Math.ceil(h.hp)+' / '+h.maxHp;$('mana-value').textContent=Math.floor(h.mana)+' / '+h.maxMana;$('potions').textContent=h.potions;
   $('potion').disabled=paused||h.potions===0||h.hp>=h.maxHp||h.potionCooldown>0;
   $('equipment').disabled=!!partyClient;$('map-open').disabled=!!partyClient;
   for(const id of ['attack','skill','dodge'])$(id).disabled=state.partyJourney?.stage===2;
   const sharedDoor=!!state.partyJourney&&state.area==='crypt'&&i?.to==='boss',partyReady=sharedDoor&&[h,...(state.partyPeers||[]).map(p=>p.hero)].filter(a=>a.hp>0).every(a=>Math.hypot(a.x-i.x,a.y-i.y)<=i.r)&&(state.partyPeers||[]).every(p=>p.hero.hp===0||p.connected);
   $('interact').hidden=!!partyClient&&!sharedDoor||!i||paused;$('interact').disabled=!!i?.locked||sharedDoor&&!partyReady;$('interact').textContent=i?.locked?'Сначала одолейте стражей':sharedDoor&&!partyReady?'Соберите отряд у двери':sharedDoor?'Отрядом к Хранителю':i?.name||'';
   const alive=state.enemies.filter(e=>e.hp>0).length;$('count').textContent=level.safe?'БЕЗОПАСНАЯ ОБЛАСТЬ':alive+' стражей';
   $('objective').textContent=state.partyJourney?.stage===2?'Отряд в лагере · поход завершён':state.partyStory?'Хранитель побеждён · результат сохранён':state.partyJourney&&state.area==='crypt'&&alive===0?'Соберитесь у верхней двери · путь к Хранителю':partyClient&&alive===0?'Область очищена · ждём продолжения от сервера':SIM.objective(state);
   document.querySelector('.quest .eyebrow').textContent=state.completed?'ВЫЛАЗКА '+state.expedition.number+' · ПЕЧАТЬ В ЛАГЕРЕ':'ПЕЧАТЬ ХРАНИТЕЛЯ';
   // Do not print a permanent instruction across the contact/telegraph plane.
   $('hint').textContent=state.partyJourney?.stage===2?'Здоровье и мана восстановлены. Запас зелий сохранён.':!i&&state.area==='camp'?'Вход в склеп — за каменным мостом справа вверху.':'';
   const skillCost=SIM.getBuild(state).skillCost;$('skill').querySelector('small').textContent=h.mana<skillCost?'Нужно '+skillCost+' маны':'Сила дара';
   if(state.steps-savedStep>=60)save();
  }
  if(partyClient&&state.duelMember){
   const peer=state.partyPeers?.[0],waiting=state.phase==='ready',done=state.phase==='finished',r=state.duelResult;
   $('area-label').textContent='КРУГ ДУЭЛИ';document.querySelector('.quest .eyebrow').textContent='ПОЕДИНОК';
   $('objective').textContent=waiting?'Готовность обоих участников':done?'Поединок завершён':peer?.connected?'Соперник':'Соперник отключён · бой продолжается';
   $('count').textContent=peer?Math.ceil(peer.hero.hp)+' / '+peer.hero.maxHp+' HP':'';$('potion').disabled=true;$('interact').hidden=true;
   $('controls').hidden=paused||state.phase!=='playing';$('result').hidden=paused||!waiting&&!done;$('change-gift').hidden=true;$('reward').hidden=true;
   if(waiting){$('result-kicker').textContent='ДОБРОВОЛЬНЫЙ ПОЕДИНОК';$('result-title').textContent=state.duelReady?'Вы готовы':'Принять вызов?';$('result-copy').textContent='Сила экипировки сохраняется: равенство не гарантируется. Зелья недоступны; предметы не теряются. '+(peer?.ready?'Соперник готов.':peer?.connected?'Соперник ещё не готов.':'Ожидаем подключения соперника.');$('retry').textContent=state.duelReady?'Отменить готовность':'Я готов';}
   if(done){$('result-kicker').textContent='РЕЗУЛЬТАТ СОХРАНЁН';$('result-title').textContent=r.reason==='cancelled'?'Вызов отменён':r.winnerId===null?'Ничья':r.winnerId===state.hero.id?'Победа':'Поражение';$('result-copy').textContent=(r.reason==='cancelled'?'Участник отменил вызов до начала боя. ':r.reason==='disconnect'?'Время переподключения истекло. ':r.reason==='timeout'?'Время поединка истекло. ':'Поединок завершён нокаутом. ')+'Предметы и одиночный прогресс сохранены. Награды не выдаются.';$('retry').textContent='К одиночному прохождению';}
   return;
  }
  if(state.phase==='won'||state.phase==='lost'){if(state.phase==='lost'&&terminalAt!==null&&visualTime-terminalAt<.85)return;const won=state.phase==='won';$('result').hidden=false;$('controls').hidden=true;$('hint').hidden=true;$('result-kicker').textContent=won?'ХРАНИЛИЩЕ ПРОБУЖДЕНО':'ОГОНЬ ЕЩЁ НЕ ПОГАС';$('result-title').textContent=won?'Свет возвращён':'Вы пали';$('result-copy').textContent=won?'Стражи пали. Память Каменного Брода снова принадлежит живым.':state.campaign?'Вернитесь в лагерь. Предметы, таланты и пройденный путь сохранятся. Зелья не пополняются.':'Отступите от красного сектора перед ударом и используйте силу подарка.';$('retry').textContent=state.campaign&&!won?'Вернуться в лагерь':'Пройти ещё раз';$('change-gift').textContent=state.campaign&&!won?'Вернуться и сменить снаряжение':'Выбрать другой подарок';$('reward').hidden=!won;
   if(partyClient){const returnToCamp=state.partyJourney?.stage===1&&state.partyStory;$('result-copy').textContent=returnToCamp?'Победа сохранена у каждого героя. Верните весь отряд в лагерь: павшие воскреснут, здоровье и мана восстановятся. Зелья не пополняются.':state.partyStory?'Отряд одолел Хранителя. Этот сюжетный результат сохранён у каждого героя. Одиночный путь, вещи и запасы не изменены.':'Общий бой остаётся на сервере. Можно наблюдать или вернуться к своему одиночному прохождению.';$('retry').textContent=returnToCamp?'Отрядом в лагерь':'К одиночному прохождению';$('change-gift').hidden=true;$('reward').hidden=true;}
   if(won&&!partyClient&&!state.savedLocally){state.savedLocally=true;try{const old=JSON.parse(localStorage.getItem('giftborne-2d-progress')||'{}');localStorage.setItem('giftborne-2d-progress',JSON.stringify({version:1,completed:true,gift:state.gift,bestHp:Math.max(Number(old.bestHp)||0,h.hp)}))}catch{}}}
 }
 function input(){SCENE.target=null;let mx=stick.mx+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),my=stick.my+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);if(moveTarget&&!mx&&!my){const dx=moveTarget.x-state.hero.x,dy=moveTarget.y-state.hero.y,d=Math.hypot(dx,dy);if(d>15){mx=dx/d;my=dy/d}else moveTarget=null}const i={mx,my,act:queued.act||held.act||keys.has('KeyJ'),skill:queued.skill||held.skill||keys.has('KeyK'),dodge:queued.dodge||held.dodge||keys.has('Space'),interact:queued.interact,potion:queued.potion,resupply:queued.resupply};Object.keys(queued).forEach(k=>queued[k]=false);if(aim){i.aimX=aim.x;i.aimY=aim.y}else if(i.act||i.skill){const targets=state.duelMember?(state.partyPeers||[]).map(p=>p.hero):state.enemies,target=targets.filter(e=>e.hp>0).map(e=>({e,d:Math.hypot(e.x-state.hero.x,e.y-state.hero.y)})).filter(x=>x.d<280&&SIM.clearLine(state.hero,x.e,SIM.levelOf(state))).sort((a,b)=>a.d-b.d)[0];if(target){SCENE.target=target.e;i.aimX=target.e.x;i.aimY=target.e.y}}return i}
 function frame(now){if(!ready)return;if(menuPanel?.visible()||mapPanel?.visible()||settingsPanel?.visible()){last=now;acc=0;requestAnimationFrame(frame);return;}const wallDt=Math.max(0,(now-last)/1000||0),dt=Math.min(.05,wallDt);last=now;frames++;frameTime+=wallDt;if(frameTime>.75){fps=Math.round(frames/frameTime);frames=0;frameTime=0}if(!paused&&state.phase==='playing'){acc+=dt;let n=0;while(acc>=SIM.DT&&n++<4){const area=state.area;if(partyClient)partyClient.input(input());else SIM.step(state,input());if(area!==state.area){clearInput();save();}acc-=SIM.DT}}else acc=0;if(!paused&&!document.hidden)visualTime+=dt;if((state.phase==='lost'||state.phase==='won')&&terminalAt===null)terminalAt=visualTime;SCENE.state=state;
  try{SCENE.render(visualTime);}catch(e){
   // A failed area upload cannot leave simulation/input running behind a frozen
   // picture. Keep the existing save and expose the existing reload action.
   partyClient?.suspend();clearInput();stopVoices();ready=false;paused=true;state.paused=true;acc=0;
   for(const id of ['controls','hint','hud','globe-hud','interact','pause-panel'])if($(id))$(id).hidden=true;
   $('error').hidden=false;
   $('error-detail').textContent='Не удалось загрузить графику. Прогресс не сброшен. Нажмите «Повторить».';return;
  }
  framing();sync();for(const e of state.ev){if(e.id<=lastEvent)continue;combatAudio?.play(e);if(e.k==='station')openStation(e.station);if(e.k==='resupply')save();lastEvent=e.id}requestAnimationFrame(frame)}
 if(!menuPanel)$('start').onclick=start;$('retry').onclick=retryEpisode;$('change-gift').onclick=changeGiftAfterResult;$('restart-paused').onclick=()=>reset(false);$('pause').onclick=()=>setPause(!paused);$('resume').onclick=()=>setPause(false);
 // Same secondary-pointer rule as the equipment button: WebKit may deliver
 // touch pointerdown/up without click while another pointer holds movement.
 bindTouchActivation($('pause'),()=>setPause(!paused));
 function bindTouchActivation(button,activate){let touchActivated=false;
  button.addEventListener('pointerdown',e=>{touchActivated=e.pointerType==='touch';if(touchActivated){e.preventDefault();activate();}});
  // Chromium can still synthesize click after touch pointerdown; WebKit may
  // omit it entirely. A physical mouse down or keyboard click stays usable.
  button.onclick=e=>{if(touchActivated&&e.detail>0){touchActivated=false;return;}touchActivated=false;activate();};
 }
 document.querySelectorAll('[data-gift]').forEach(b=>b.onclick=()=>{selected=b.dataset.gift;SIM.equip(state,selected);document.querySelectorAll('[data-gift]').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on))})});
 $('sound').onclick=async()=>{applyPreferences({...preferenceStore.value,audioEnabled:!audioOn});await unlockAudio();if(audioOn)tone(500,.15,.02)};
 $('quality').onclick=()=>applyPreferences({...preferenceStore.value,quality:preferenceStore.value.quality==='balanced'?'low':'balanced'});
 addEventListener('keydown',e=>{if(settingsPanel?.visible()){if(e.code==='Escape'){e.preventDefault();closeSettings();}return;}if(mapPanel?.visible()){if(e.code==='Escape'){e.preventDefault();closeMap();}return;}if(equipmentPanel?.visible()){if(e.code==='Escape'){e.preventDefault();closeEquipment();}return;}if(menuPanel?.visible())return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&!e.repeat)setPause(!paused);if(e.code==='Enter'&&state.phase==='ready')start();if(e.code==='KeyR'&&!e.repeat&&['won','lost'].includes(state.phase))retryEpisode();if(!paused){keys.add(e.code);if(!e.repeat&&e.code==='KeyE')queued.interact=true;if(!e.repeat&&e.code==='Digit1')queued.potion=true;if(e.code.startsWith('Arrow')||['KeyW','KeyA','KeyS','KeyD'].includes(e.code))moveTarget=null}});
 addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{clearInput();setPause(true);save()});document.addEventListener('visibilitychange',()=>{if(document.hidden){giftProfile?.invalidate();clearInput();setPause(true);save()}else if(saveFailed||saveReadFailed)showSaveFailure();});addEventListener('pagehide',()=>{giftProfile?.invalidate();clearInput();setPause(true);save()});addEventListener('pageshow',()=>{if(saveFailed||saveReadFailed)showSaveFailure();});addEventListener('resize',()=>{clearInput();framing()});
 canvas.addEventListener('pointerdown',e=>{if(state.phase!=='playing'||paused)return;const p=point(e);if(e.button===2){aim=p;held.act=true;canvas.setPointerCapture(e.pointerId)}else moveTarget=p});canvas.addEventListener('pointerup',()=>{held.act=false;aim=null});canvas.addEventListener('pointercancel',clearInput);canvas.addEventListener('contextmenu',e=>e.preventDefault());
 for(const [id,action] of [['attack','act'],['skill','skill'],['dodge','dodge']]){const b=$(id);
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||state.phase!=='playing'||actionPointers[action]!==null)return;unlockAudio();actionPointers[action]=e.pointerId;held[action]=queued[action]=true;b.setPointerCapture(e.pointerId)});
  b.addEventListener('pointerup',e=>{if(actionPointers[action]!==e.pointerId)return;held[action]=false;actionPointers[action]=null;});
  for(const ev of ['pointercancel','lostpointercapture'])b.addEventListener(ev,e=>{if(actionPointers[action]!==e.pointerId)return;held[action]=queued[action]=false;actionPointers[action]=null;});
 }
 function updateStick(e){const r=$('joystick').getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),radius=r.width*.36;stick=PREFERENCES.stick(dx,dy,radius,preferenceStore.value.stickSensitivity);$('stick').style.transform=`translate(${stick.mx*radius}px,${stick.my*radius}px)`}
 $('joystick').addEventListener('pointerdown',e=>{if(stickId!==null||state.phase!=='playing'||paused)return;e.preventDefault();stickId=e.pointerId;moveTarget=null;$('joystick').setPointerCapture(e.pointerId);updateStick(e)});$('joystick').addEventListener('pointermove',e=>{if(e.pointerId===stickId)updateStick(e)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(ev,e=>{if(e.pointerId===stickId){stickId=null;stick={mx:0,my:0};$('stick').style.transform=''}});
 try{G.init(canvas,SIM.VIEW.W,SIM.VIEW.H);const assets=legacy?ASSETS:PIVOT_ASSETS,plates=new Set(legacy?[]:Object.values(CAMPAIGN.AREAS).map(a=>a.background));await Promise.all(Object.entries(assets).map(([name,a])=>G.load(name,a.url||'assets/'+name+'.png',{exclusiveGroup:plates.has(name)?'campaign-background':null})));COMBAT_AUDIO.preload();await equipmentPanel?.ready();await menuPanel?.ready();await mapPanel?.ready();await settingsPanel?.ready();SCENE.programs();syncPreferences();motionPreference.addEventListener('change',()=>{clearInput();syncPreferences();settingsPanel?.refresh();});ready=true;if(menuPanel)menuPanel.loaded();else{$('start').disabled=false;$('start').textContent='Войти в Каменный Брод';}if(saveReadFailed)showSaveFailure();last=performance.now();requestAnimationFrame(frame)}catch(e){$('error').hidden=false;$('error-detail').textContent=e.message;console.error(e)}
})();
