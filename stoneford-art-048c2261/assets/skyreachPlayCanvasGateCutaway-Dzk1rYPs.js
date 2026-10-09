import{g as e,i as t}from"./entity-BcCrbfZz.js";import{Pn as n,sn as r}from"./env-lighting-BauSjaK_.js";var i=class{view=new e;point=new n;hero=new Float32Array(4);target=new Float32Array(4);originals=new Map;materials=new Map;disposed=!1;constructor(e){for(let n of e){let e=n.material;if(!(e instanceof t))continue;let i=this.materials.get(e);if(!i){i=e.clone(),i.name=`${e.name}:actor-cutaway`,i.shaderChunksVersion=`2.22`;let t=i.getShaderChunks(r);t.set(`litUserDeclarationPS`,`
uniform mat4 giftborneCutawayView;
uniform vec4 giftborneHeroCutaway;
uniform vec4 giftborneTargetCutaway;
`),t.set(`litUserMainStartPS`,`
#ifdef FORWARD_PASS
vec3 gateView = (giftborneCutawayView * vec4(vPositionW, 1.0)).xyz;
vec2 heroMask = (gateView.xy - giftborneHeroCutaway.xy) / vec2(1.15, 1.45);
if (giftborneHeroCutaway.w > 0.5 && gateView.z > giftborneHeroCutaway.z + 0.2 && dot(heroMask, heroMask) < 1.0) discard;
vec2 targetMask = (gateView.xy - giftborneTargetCutaway.xy) / vec2(1.15, 1.45);
if (giftborneTargetCutaway.w > 0.5 && gateView.z > giftborneTargetCutaway.z + 0.2 && dot(targetMask, targetMask) < 1.0) discard;
#endif
`),i.setParameter(`giftborneCutawayView`,this.view.data),i.setParameter(`giftborneHeroCutaway`,this.hero),i.setParameter(`giftborneTargetCutaway`,this.target),i.update(),this.materials.set(e,i)}this.originals.set(n,e),n.material=i}}update(e,t,n){this.disposed||(this.view.invert(e.getWorldTransform()),this.write(this.hero,t),this.write(this.target,n))}write(e,t){e[3]=t===null?0:1,t&&(this.point.copy(t),this.point.y+=.95,this.view.transformPoint(this.point,this.point),e[0]=this.point.x,e[1]=this.point.y,e[2]=this.point.z)}clear(){this.hero[3]=this.target[3]=0}dispose(){if(!this.disposed){this.disposed=!0,this.clear();for(let[e,t]of this.originals)e.material===this.materials.get(t)&&(e.material=t);for(let e of this.materials.values())e.destroy();this.originals.clear(),this.materials.clear()}}};export{i as t};