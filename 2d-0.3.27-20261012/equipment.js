/* Presentation only: inventory commands and all capacities belong to SIM. */
(function(root){
 'use strict';
 const gifts={sword:{name:'Light Sword · Absinthe',image:'assets/pivot/gift_sword.png'},orb:{name:'Crystal Ball · Seeing Red',image:'assets/pivot/gift_orb.png'}};
 function view(state,sim,selected=state.gift){const id=Object.hasOwn(gifts,selected)?selected:state.gift,g=sim.getBuild(state,id),h=state.hero;return{id,...gifts[id],equipped:id===state.gift,damage:g.damage,skillDamage:g.skillDamage,skillName:g.skillName,description:g.description,skillCooldown:g.skillCooldown,hp:h.hp,maxHp:h.maxHp,mana:h.mana,maxMana:h.maxMana,potions:h.potions,ownership:'preview'};}
 function mount({state,sim,command,talentCommand,close}){
  const I=root.INVENTORY,preload=['ui_panel.png',...new Set(Object.values(I.CATALOG).map(d=>d.image))].map(file=>{const img=new Image();img.src='assets/pivot/'+file;return img;});
  const panel=document.createElement('dialog');panel.id='equipment-panel';panel.className='inventory-panel';panel.setAttribute('aria-labelledby','equipment-title');
  panel.innerHTML=`<header class="inv-heading"><h2 id="equipment-title">Снаряжение</h2><nav aria-label="Раздел персонажа"><button id="equipment-items">Герой</button><button id="equipment-bag">Рюкзак</button><button id="equipment-skills">Умение</button></nav><button id="equipment-close" aria-label="Закрыть снаряжение">×</button></header><div class="inv-content"><section id="inventory-slots" aria-label="11 слотов снаряжения"></section><section id="inventory-grid" aria-label="Рюкзак 6 на 4 клетки"></section><article id="equipment-detail"><div class="inv-item-heading"><img id="equipment-image" alt=""><div><small id="equipment-kind"></small><h3 id="equipment-name"></h3></div></div><p id="equipment-description"></p><dl id="equipment-stats"></dl><div class="inv-actions"><select id="equipment-slot" aria-label="Слот кольца"></select><button id="equip-selected">Надеть</button><button id="inventory-move">Перенос</button><button id="inventory-pack">Автоукладка</button><button id="inventory-cancel" hidden>Отмена переноса</button></div></article></div><section id="skills-page" hidden></section><footer><p id="equipment-message" role="status" aria-live="polite"></p><span>DEV-набор · владение Gifts не проверено · вид брони пока базовый</span></footer>`;
  document.getElementById('game').append(panel);const $=id=>panel.querySelector('#'+id);
  const skillsPage=SKILLS_UI.mount({container:$('skills-page'),state,sim,command:talentCommand});
  let selected=state().gift,tab='items',moving=false,message='',targetSlot='rightHand',renderedRevision=0;
  const errors={combat:'Сначала завершите бой или действие героя.',space:'Не хватает свободного места. Предметы не изменены.',slot:'Предмет не подходит для этого слота.',stale:'Снаряжение изменилось. Выберите предмет ещё раз.',weapon:'Замените Gift другим: правая рука не может быть пустой.',invalid:'Некорректное размещение.',missing:'Предмет не найден.'};
  function act(c,success){const r=command({...c,revision:renderedRevision});message=r.ok?(r.changed?success:'Уже на месте.'):errors[r.reason]||'Действие недоступно.';if(r.ok)moving=false;render();}
  function pick(id){selected=id;moving=false;message='';const d=I.item(state().inventory,id);targetSlot=d?.slots[0]||'rightHand';render();}
  const itemImage=d=>'assets/pivot/'+d.image;
  function render(){
   const s=state(),i=s.inventory;renderedRevision=i.revision;const d=I.item(i,selected),loc=d&&I.location(i,selected),skills=tab==='skills',bag=tab==='bag';
   panel.classList.toggle('skills-mode',skills);$('skills-page').hidden=!skills;$('equipment-title').textContent=skills?'Умения и таланты':'Снаряжение';
   $('equipment-skills').textContent='Умения';
   for(const [key,id]of [['items','equipment-items'],['bag','equipment-bag'],['skills','equipment-skills']])$(id).setAttribute('aria-pressed',String(tab===key));
   if(skills){skillsPage.open();return;}
   $('inventory-slots').hidden=tab!=='items';$('inventory-grid').hidden=!bag;
   $('inventory-slots').replaceChildren();
   for(const [slot,label]of Object.entries(I.SLOTS)){
    const id=i.slots[slot],def=id&&I.item(i,id),b=document.createElement('button');b.id='slot-'+slot;b.dataset.slot=slot;b.setAttribute('aria-label',label+': '+(def?.name||'Пусто'));b.setAttribute('aria-pressed',String(id===selected));
    if(def){const img=new Image();img.src=itemImage(def);img.alt='';b.append(img);}const caption=document.createElement('span');caption.textContent=label;b.append(caption);b.classList.toggle('empty',!def);b.onclick=()=>{if(id)pick(id);else{selected=null;message=label+' — пусто. Выберите предмет в рюкзаке.';render();}};$('inventory-slots').append(b);
   }
   const grid=$('inventory-grid');grid.replaceChildren();grid.classList.toggle('moving',moving);
   for(let y=0;y<I.H;y++)for(let x=0;x<I.W;x++){
    const b=document.createElement('button');b.id=`cell-${x}-${y}`;b.className='inv-cell';b.style.gridArea=`${y+1}/${x+1}`;b.setAttribute('aria-label',`Клетка ${x+1}, ${y+1}`);
    const covered=Object.entries(i.bag).some(([id,p])=>{const def=I.item(i,id);return x>=p.x&&x<p.x+def.w&&y>=p.y&&y<p.y+def.h;});
    b.style.visibility=covered&&!moving?'hidden':'visible';b.disabled=!moving;
    if(moving)b.classList.toggle('fits',I.fits(i,selected,x,y));
    b.onclick=()=>{if(moving)act({kind:'move',id:selected,x,y},'Предмет переложен.');};grid.append(b);
   }
   for(const [id,p]of Object.entries(i.bag)){
    const def=I.item(i,id),b=document.createElement('button');b.id='loadout-'+id;b.className='inv-item';b.style.gridArea=`${p.y+1}/${p.x+1}/span ${def.h}/span ${def.w}`;b.setAttribute('aria-label',def.name+`, ${def.w}×${def.h}`);b.setAttribute('aria-pressed',String(id===selected));
    const img=new Image();img.src=itemImage(def);img.alt='';b.append(img);b.disabled=moving;b.style.pointerEvents=moving?'none':'';b.onclick=()=>pick(id);grid.append(b);
   }
   const v=view(s,sim),display=d,g=display?.gift&&sim.getBuild(s,display.gift);
   $('equipment-image').hidden=!display;if(display){$('equipment-image').src=itemImage(display);$('equipment-image').alt=display.name;}
   $('equipment-name').textContent=skills?v.skillName:display?.name||'Пустой слот';
   $('equipment-kind').textContent=skills?'УМЕНИЕ':display?(display.gift?'GIFT · ПРОБНЫЙ':I.SLOTS[display.slots[0]].toUpperCase()):'СНАРЯЖЕНИЕ';
   $('equipment-description').textContent=skills?v.description:display?`${display.w}×${display.h} клетки · ${loc?.slot?'Экипирован: '+I.SLOTS[loc.slot]:'В рюкзаке'}`:'Предметы можно надеть из рюкзака.';
   const stats=skills?[['Урон',v.skillDamage,'equipment-ability-damage'],['Перезарядка',v.skillCooldown+' с','equipment-cooldown']]:g?[['Удар',g.damage,'equipment-damage'],['Умение',g.skillDamage,'equipment-skill-damage']]:display?[['Здоровье','+'+display.hp+' к максимуму','equipment-health-bonus'],['Мана','+'+display.mana+' к максимуму','equipment-mana-bonus']]:[];
   $('equipment-stats').replaceChildren();for(const [label,value,id]of stats){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dd.id=id;row.append(dt,dd);$('equipment-stats').append(row);}
   
   $('equip-selected').hidden=skills||!d||moving;$('equip-selected').disabled=loc?.slot==='rightHand';$('equip-selected').textContent=loc?.slot?(loc.slot==='rightHand'?'Экипирован':'Снять'):'Надеть';
   const ring=!!d&&d.slots.length>1&&!loc?.slot&&!skills&&!moving;$('equipment-slot').hidden=!ring;
   if(ring){$('equipment-slot').replaceChildren();for(const slot of d.slots){const option=document.createElement('option');option.value=slot;option.textContent=slot==='ring1'?'I':'II';option.setAttribute('aria-label',I.SLOTS[slot]);$('equipment-slot').append(option);}$('equipment-slot').value=targetSlot;}
   $('inventory-move').hidden=!bag||!d||!!loc?.slot||moving;$('inventory-pack').hidden=!bag||moving;$('inventory-cancel').hidden=!moving;
   $('equipment-message').textContent=message||(s.inventoryRecovered?'Повреждённый DEV-инвентарь восстановлен; прохождение сохранено.':moving?'Нажмите клетку для левого верхнего угла предмета.':`HP ${Math.ceil(v.hp)}/${v.maxHp} · Мана ${Math.floor(v.mana)}/${v.maxMana} · ${bag?'Выберите предмет.':'11 слотов'}`);
  }
  for(const [id,name]of [['equipment-items','items'],['equipment-bag','bag'],['equipment-skills','skills']])$(id).onclick=()=>{tab=name;moving=false;message='';if(name==='bag'&&!I.location(state().inventory,selected)){pick(Object.keys(state().inventory.bag)[0]);return;}render();};
  $('equipment-slot').onchange=()=>{targetSlot=$('equipment-slot').value;};
  $('equip-selected').onclick=()=>{const loc=I.location(state().inventory,selected);if(loc?.slot)act({kind:'unequip',id:selected},'Предмет убран в рюкзак.');else act({kind:'equip',id:selected,slot:targetSlot},'Экипирован.');};
  $('inventory-move').onclick=()=>{moving=true;message='';render();};$('inventory-cancel').onclick=()=>{moving=false;message='Перенос отменён; предмет не изменён.';render();};$('inventory-pack').onclick=()=>act({kind:'pack'},'Рюкзак уложен.');
  $('equipment-close').onclick=close;panel.addEventListener('cancel',e=>{e.preventDefault();close();});
  return{ready:()=>Promise.all([...preload.map(img=>img.decode()),skillsPage.ready()]),open(){selected=state().gift;tab='items';moving=false;message='';render();panel.showModal();$('equipment-close').focus();},hide(){moving=false;if(panel.open)panel.close();},visible:()=>panel.open};
 }
 const api={view,mount};root.EQUIPMENT_UI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
