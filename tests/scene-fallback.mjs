import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scenario=process.argv[2];
if(!scenario){
 for(const name of ['no-webgl','data-failure','paused','reduced-motion']){
  const result=spawnSync(process.execPath,['--experimental-default-type=module',fileURLToPath(import.meta.url),name],{encoding:'utf8'});
  assert.equal(result.status,0,`${name}: ${result.stdout}${result.stderr}`);
 }
 console.log('Scene integration: graphics failures preserve text/navigation; paused and reduced-motion scenes navigate independently; short viewports use readable document flow.');
}else{
 let now=0,rafId=0,rafs=new Map(),draws=[];
 class Target {
  constructor(kind=''){this.kind=kind;this.listeners=new Map();this.attributes={};this.children=[];this.style={};}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  dispatchEvent(event){event.target??=this;for(const fn of this.listeners.get(event.type)||[])fn(event);return !event.defaultPrevented;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key]??null;}
  append(...children){this.children.push(...children);}
  remove(){}
  closest(selector){
   if(selector==='main > section')return this.section||null;
   return selector.split(',').some(part=>part===this.kind||part==='a[href]'&&this.kind==='a')?this:null;
  }
 }
 class Classes{
  values=new Set();add(value){this.values.add(value);}
  contains(value){return this.values.has(value);}
  toggle(value,enabled){if(enabled)this.values.add(value);else this.values.delete(value);}
 }
 const win=new Target(),doc=new Target(),media=new Target();media.matches=scenario==='reduced-motion';
 globalThis.window=win;globalThis.document=doc;globalThis.innerHeight=800;globalThis.innerWidth=1280;globalThis.scrollY=0;
 globalThis.performance={now:()=>now};globalThis.matchMedia=()=>media;globalThis.getSelection=()=>({toString:()=>''});
 globalThis.requestAnimationFrame=fn=>{rafs.set(++rafId,fn);return rafId;};globalThis.cancelAnimationFrame=id=>rafs.delete(id);
 globalThis.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail;}};
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){}disconnect(){}};
 globalThis.getComputedStyle=node=>({width:String(node.copyWidth),height:String(node.offsetHeight)});
 const location=new URL('http://localhost/'+(scenario==='data-failure'?'#background':''));globalThis.location=location;
 globalThis.history={state:null,scrollRestoration:'auto',replaceState(_,unused,url){location.href=new URL(url,location).href;},pushState(_,unused,url){location.href=new URL(url,location).href;}};
 function emit(target,type,props={}){
  const event={type,target:doc.body,defaultPrevented:false,cancelable:true,preventDefault(){this.defaultPrevented=true;},...props};
  target.dispatchEvent(event);return event;
 }
 win.scrollTo=(_,y)=>{globalThis.scrollY=y;emit(win,'scroll');};
 doc.body=new Target('body');doc.documentElement={scrollHeight:3250,classList:new Classes()};doc.createElement=kind=>new Target(kind);doc.fonts={ready:Promise.resolve()};
 const geometry=[[84,760],[848.5,801.5],[1650,800.25],[2450,800]];
 const sections=geometry.map((_,index)=>{
  const section=new Target('section');section.id=['','background','','elsewhere'][index];section.attributes['aria-labelledby']=['name','background-title','current-title','elsewhere-title'][index];section.section=section;
  section.getBoundingClientRect=()=>({top:geometry[index][0]-scrollY,height:geometry[index][1]});return section;
 });
 const copies=sections.map((section,index)=>{const copy=new Target('div');copy.section=section;copy.copyWidth=index===0?620:440;copy.offsetHeight=[302,306,286,180][index];return copy;});
 const ids=Object.fromEntries(sections.flatMap(section=>{
  const heading=new Target('h2');heading.section=section;
  return [[section.attributes['aria-labelledby'],heading],...(section.id?[[section.id,section]]:[])];
 }));
 const canvas=new Target('canvas'),play=new Target('button'),detail=new Target('select');detail.value='1.25';
 canvas.getBoundingClientRect=()=>({width:innerWidth,height:innerHeight});
 const gl=new Proxy({
  createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,name)=>name,
  uniformMatrix4fv:(name,transpose,values)=>{if(name==='camera')draws.push([...values]);},
 },{get(target,key){return key in target?target[key]:String(key).toUpperCase()===key?1:()=>{};}});
 canvas.getContext=()=>scenario==='no-webgl'?null:gl;
 const manifold=JSON.parse(await readFile(new URL('../dodecahedral-data.json',import.meta.url),'utf8'));
 globalThis.fetch=async()=>({ok:scenario!=='data-failure',json:async()=>manifold});
 const nodes={'#space':canvas,'#play':play,'#detail':detail,'#background':sections[1],'.current':sections[2],'.elsewhere':sections[3]};
 doc.querySelector=selector=>nodes[selector];doc.querySelectorAll=selector=>selector==='main > section'?sections:copies;doc.getElementById=id=>ids[id];
 const warnings=[],errors=[];console.warn=(...args)=>warnings.push(args.join(' '));console.error=(...args)=>errors.push(args.join(' '));
 function advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+16);const queue=[...rafs.values()];rafs.clear();for(const fn of queue)fn(now);}}
 function visible(index){
  assert.equal(copies[index].style.visibility,'visible');assert.equal(copies[index].style.opacity,'1');assert.equal(copies[index].inert,false);
  assert.match(copies[index].style.transform,/^matrix3d\(/);
  copies.forEach((copy,i)=>{if(i!==index)assert.equal(copy.inert,true);});
 }
 await import('../app.js');
 for(let i=0;i<12;i++)await Promise.resolve();
 advance(32);
 assert.deepEqual(errors,[],'application initialization should not throw');
 assert.equal(doc.documentElement.classList.contains('projected-text'),true);
 const controls=doc.body.children.find(node=>node.className==='section-controls');assert.ok(controls,'navigation is initialized before graphics can fail');
 const next=controls.children[2];
 if(scenario==='no-webgl'||scenario==='data-failure'){
  assert.equal(play.disabled,true);assert.equal(detail.disabled,true);
  assert.equal(warnings.length,1);assert.match(warnings[0],scenario==='no-webgl'?/WebGL 2 unavailable/:/Manifold data could not be loaded/);
  const initial=scenario==='data-failure'?1:0;visible(initial);
  emit(next,'click');advance(1200);visible(initial+1);
  assert.equal(draws.length,0,'graphics failure does not prevent selecting the next text plane');
 }else{
  assert.equal(warnings.length,0);assert.ok(draws.length>0);visible(0);
  if(scenario==='paused'){emit(play,'click');advance(16);assert.equal(play.textContent,'Resume background');}
  else assert.equal(play.textContent,'Resume background');
  const frozen=draws.at(-1),drawCount=draws.length;
  emit(next,'click');advance(1200);visible(1);
  assert.equal(draws.length,drawCount,'changing a reading stop does not move a paused/reduced-motion background');
  assert.deepEqual(draws.at(-1),frozen);
  if(scenario==='paused')emit(play,'click');
  else{media.matches=false;emit(media,'change');}
  advance(32);visible(1);assert.notDeepEqual(draws.at(-1),frozen,'resuming moves the camera to the selected stop');
 }
 // The same initialized page must remain readable when a phone rotates to landscape.
 globalThis.innerHeight=390;emit(win,'resize');advance(32);
 assert.equal(doc.documentElement.classList.contains('projected-text'),false);assert.equal(controls.hidden,true);
 copies.forEach(copy=>{assert.equal(copy.style.transform,'');assert.equal(copy.style.visibility,'');assert.equal(copy.inert,false);});
 assert.equal(emit(win,'wheel',{deltaX:0,deltaY:80}).defaultPrevented,false,'short viewports retain ordinary scrolling');
 globalThis.innerHeight=800;emit(win,'resize');advance(32);
 assert.equal(doc.documentElement.classList.contains('projected-text'),true);assert.equal(controls.hidden,false);
 assert.deepEqual(errors,[]);
}
