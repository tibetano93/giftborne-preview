/* Versioned local episode data. No Telegram ownership or network authority. */
(function(root){
 'use strict';
 const PLATE=[1672,941],foreground=(id,points,base,radius)=>Object.freeze({id,points,base,radius});
 const area=(id,name,spawn,walkable,doors,extra={})=>Object.freeze({id,name,spawn,walkable,doors,bounds:{minX:70,maxX:1840,minY:130,maxY:1055},
  foreground:[],obstacles:(extra.foreground||[]).map(p=>Object.freeze({id:p.id,x:p.base[0]*1920/PLATE[0],y:p.base[1]*1080/PLATE[1],r:p.radius*1920/PLATE[0]})),...extra});
 const corridor=[[[180,1015],[235,875],[1190,255],[1470,235],[1765,285],[1430,540],[610,1030]]];
 const AREAS={
  camp:area('camp','Каменный Брод',{x:905,y:625},[
   [[330,560],[860,370],[1180,420],[1520,610],[1410,805],[1120,765],[735,990],[465,945],[715,680]],
   [[1100,425],[1350,205],[1460,170],[1470,250],[1185,530]],
   [[310,445],[485,350],[760,340],[940,435],[685,595]],
   [[1330,550],[1575,535],[1730,630],[1650,735],[1470,730]]
  ],[{x:1370,y:270,r:105,to:'crypt',name:'Спуститься в склеп'}],{safe:true,background:'pivot_camp',stations:[{id:'forge',x:480,y:415,name:'Кузница'},{id:'merchant',x:1530,y:640,name:'Снабжение'}]}),
  // The doorway arrival remains on the entrance walkway, outside the left
  // resource globe in the selected landscape framing. No combat repositioning.
  crypt:area('crypt','Затопленный склеп',{x:560,y:870},corridor,[{x:310,y:950,r:85,to:'camp',name:'В лагерь'},{x:1530,y:345,r:110,to:'boss',name:'К Хранителю',requiresClear:true}],{background:'pivot_crypt',foreground:[
   // Outline in the existing painted plate; base drives both draw depth and
   // the SIM's established circular footprint. No extra image/hidden arena.
   foreground('crypt-entry-brazier',[[396,568],[438,577],[437,622],[457,671],[431,690],[395,682],[374,664],[386,620]],[418,672],33)
  ]}),
  boss:area('boss','Печать Хранителя',{x:450,y:610},[[[260,480],[590,285],[1190,200],[1580,330],[1710,520],[1480,810],[1000,925],[550,765]]],[{x:335,y:560,r:90,to:'crypt',name:'Назад в склеп'},{x:1530,y:370,r:105,to:'camp',name:'Вернуть печать в лагерь',requiresClear:true}],{background:'pivot_boss'})
 };
 const ENEMIES={camp:[],crypt:[
  ['crypt-1','raider',650,825,44,.82],['crypt-2','raider',745,805,44,.88],
  ['crypt-3','sentinel',790,710,66,1.05],['crypt-4','raider',885,710,44,.78],
  ['crypt-5','raider',980,630,44,.84],['crypt-6','sentinel',1075,625,66,1.1],
  ['crypt-7','raider',1145,505,44,.86],['crypt-8','raider',1255,470,44,.92]
 ],boss:[['seal-warden','boss',1190,520,220,1.18]]};
 function inside(x,y,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;
 }return yes;}
 // The same floor/solid contract is used for movement AND save restoration
 // of players/enemies; old saves cannot leave an actor trapped inside a prop.
 function walkable(level,x,y,r=0){return [[0,0],[-r,0],[r,0],[0,-r],[0,r]].every(([dx,dy])=>level.walkable.some(p=>inside(x+dx,y+dy,p)))&&!level.obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+r-.01);}
 const api={VERSION:1,AREAS,ENEMIES,walkable};root.CAMPAIGN=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
