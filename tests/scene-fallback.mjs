import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {transitionDuration,textSlideDuration,transitionProgress} from '../transition-timing.js';
import {projectReadingPlaneWithDepth,readingPhase} from '../projection.js';

const scenario=process.argv[2];
if(!scenario){
 for(const name of ['media-clock','autoplay-rejection','media-failure','paused','reduced-motion','rounded-scroll','short-viewport','rewind-cancel']){
  const result=spawnSync(process.execPath,['--experimental-default-type=module',fileURLToPath(import.meta.url),name],{encoding:'utf8'});
  assert.equal(result.status,0,`${name}: ${result.stdout}${result.stderr}`);
 }
 console.log('Scene integration: decoded media frames drive text; stalls, rounded scrolling and visibility retain the same pose; playback failures preserve navigation; pause/reduced motion, rewind, cancellation and short-viewport flow pass.');
}else{
 let now=0,nextId=0,rafs=new Map(),timers=new Map();
 class Target {
  constructor(kind=''){this.kind=kind;this.listeners=new Map();this.attributes={};this.children=[];this.style={};}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  dispatchEvent(event){event.target??=this;for(const fn of this.listeners.get(event.type)||[])fn(event);return !event.defaultPrevented;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key]??null;}
  append(...children){this.children.push(...children);}
  remove(){}
  focus(options){document.activeElement=this;this.focusOptions=options;document.dispatchEvent({type:'focusin',target:this});}
  closest(selector){
   if(selector==='main > section')return this.section||null;
   return selector.split(',').some(part=>part===this.kind||part==='a[href]'&&this.kind==='a')?this:null;
  }
 }
 class Classes {
  values=new Set();add(value){this.values.add(value);}
  contains(value){return this.values.has(value);}
  toggle(value,enabled){if(enabled)this.values.add(value);else this.values.delete(value);}
 }
 class Video extends Target {
  constructor(){super('video');this.frames=new Map();this.sources=[];this.currentTime=0;this.readyState=4;this.paused=true;this.hidden=true;this.playCalls=0;}
  canPlayType(type){return type.startsWith('video/mp4')?'probably':'';}
  load(){this.sources.push(this.src);this.currentTime=0;}
  play(){++this.playCalls;this.paused=false;return scenario==='autoplay-rejection'?Promise.reject(new Error('Autoplay blocked')):Promise.resolve();}
  pause(){this.paused=true;}
  requestVideoFrameCallback(fn){const id=++nextId;this.frames.set(id,fn);return id;}
  cancelVideoFrameCallback(id){this.frames.delete(id);}
  present(seconds){
   assert.equal(this.paused,false,'a paused player must not consume another decoded frame');
   const [id,fn]=this.frames.entries().next().value??[];assert.ok(fn,'a frame callback must be pending');
   this.frames.delete(id);this.currentTime=seconds;fn(now,{mediaTime:seconds});
  }
 }
 const win=new Target(),doc=new Target(),media=new Target();media.matches=scenario==='reduced-motion';
 globalThis.window=win;globalThis.document=doc;globalThis.innerHeight=scenario==='short-viewport'?390:800;globalThis.innerWidth=1280;globalThis.scrollY=0;
 Object.defineProperty(globalThis,'navigator',{value:{connection:{saveData:false}},configurable:true});
 const downloaded=[];
 globalThis.fetch=async url=>({ok:true,blob:async()=>{downloaded.push(url);return Object.assign(new Blob(['encoded video']),{source:url});}});
 URL.createObjectURL=blob=>'blob:'+blob.source;
 URL.revokeObjectURL=()=>{};
 globalThis.performance={now:()=>now};globalThis.matchMedia=()=>media;globalThis.getSelection=()=>({toString:()=>''});
 globalThis.requestAnimationFrame=fn=>{rafs.set(++nextId,fn);return nextId;};globalThis.cancelAnimationFrame=id=>rafs.delete(id);
 globalThis.setTimeout=(fn,ms)=>{timers.set(++nextId,{fn,at:now+ms});return nextId;};globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail;}};
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){}disconnect(){}};
 globalThis.getComputedStyle=node=>({width:String(node.copyWidth),height:String(node.offsetHeight)});
 const location=new URL('http://localhost/');globalThis.location=location;
 globalThis.history={state:null,scrollRestoration:'auto',replaceState(_,unused,url){location.href=new URL(url,location).href;},pushState(_,unused,url){location.href=new URL(url,location).href;}};
 function emit(target,type,props={}){
  const event={type,target:doc.body,defaultPrevented:false,cancelable:true,preventDefault(){this.defaultPrevented=true;},...props};
  target.dispatchEvent(event);return event;
 }
 win.scrollTo=(_,y)=>{globalThis.scrollY=scenario==='rounded-scroll'?Math.round(y):y;emit(win,'scroll');};
 doc.body=new Target('body');doc.documentElement={scrollHeight:3250,classList:new Classes()};doc.createElement=kind=>new Target(kind);doc.fonts={ready:Promise.resolve()};doc.hidden=false;
 const geometry=[[84,760],[848.5,801.5],[1650,800.25],[2450,800]];
 const sections=geometry.map((_,index)=>{
  const section=new Target('section');section.id=['','background','','elsewhere'][index];section.attributes['aria-labelledby']=['name','background-title','current-title','elsewhere-title'][index];section.section=section;
  Object.defineProperty(section,'offsetHeight',{get:()=>geometry[index][1]});
  section.getBoundingClientRect=()=>({top:geometry[index][0]-scrollY,height:geometry[index][1]});return section;
 });
 const copies=sections.map((section,index)=>{const copy=new Target('div');copy.section=section;copy.copyWidth=index===0?620:440;copy.offsetHeight=[302,306,286,180][index];return copy;});
 const ids=Object.fromEntries(sections.flatMap(section=>{
  const heading=new Target('h2');heading.section=section;
  return [[section.attributes['aria-labelledby'],heading],...(section.id?[[section.id,section]]:[])];
 }));
 const video=new Video(),still=new Target('img'),play=new Target('button'),year=new Target('span');
 const nodes={'#background-video':video,'#background-still':still,'#play':play,'#copyright-year':year};
 doc.querySelector=selector=>nodes[selector];doc.querySelectorAll=selector=>selector==='main > section'?sections:copies;doc.getElementById=id=>ids[id];
 const errors=[];console.error=(...args)=>errors.push(args.join(' '));
 function advance(ms){
  const end=now+ms;
  while(now<end){
   now=Math.min(end,now+16);
   for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}
   const queue=[...rafs.values()];rafs.clear();for(const fn of queue)fn(now);
  }
 }
 async function flush(){for(let i=0;i<40;i++)await Promise.resolve();}
 function visible(index){
  assert.equal(copies[index].style.visibility,'visible');assert.equal(copies[index].style.opacity,'1');assert.equal(copies[index].inert,false);
  assert.equal(copies[index].style.transform,`translate(${(innerWidth-copies[index].copyWidth)/2}px, ${(innerHeight-copies[index].offsetHeight)/2}px)`,'a reading station uses an exact centered 2D translation');
  copies.forEach((copy,i)=>{
   assert.equal(copy.style.willChange,'auto','stationary and hidden text releases its compositor hint');
   if(i!==index){assert.equal(copy.inert,true);assert.equal(copy.style.transform,'','hidden planes do not retain a perspective raster');}
  });
 }
 function expectedTransform(index,progress){
  const matrix=projectReadingPlaneWithDepth(readingPhase(progress),readingPhase(index),copies[index].copyWidth,copies[index].offsetHeight,innerWidth,innerHeight).matrix;
  return `matrix3d(${matrix.join(',')})`;
 }
 function endLeg(){const ended=video.onended;assert.ok(ended);ended();}
 await import('../app.js');await flush();advance(32);
 assert.deepEqual(errors,[],'application initialization should not throw');
 assert.equal(year.textContent,String(new Date().getFullYear()));
 const controls=doc.body.children.find(node=>node.className==='section-controls');assert.ok(controls,'navigation initializes independently of media playback');
 const previous=controls.children[0],next=controls.children[2];
 if(scenario==='short-viewport'){
  assert.equal(doc.documentElement.classList.contains('projected-text'),false);assert.equal(controls.hidden,true);
  copies.forEach(copy=>{assert.equal(copy.style.transform,'');assert.equal(copy.inert,false);});
  assert.equal(emit(win,'wheel',{deltaX:0,deltaY:80}).defaultPrevented,false);
  win.scrollTo(0,1650);assert.equal(still.src,'./media/station-2.webp','ordinary scrolling selects the nearest station poster');
  assert.equal(video.playCalls,0,'document flow never begins an animated transition');
 }else{
  assert.equal(doc.documentElement.classList.contains('projected-text'),true);visible(0);
  assert.equal(still.src,'./media/station-0.webp');
  if(scenario==='media-clock'){
   const initial=copies[0].style.transform;emit(next,'click');await flush();
   assert.match(video.src,/transition-0-forward\.mp4$/);assert.equal(video.hidden,true,'a station poster remains until the first presented frame');
   assert.ok(video.src.startsWith('blob:'),'the application plays a complete downloaded file');
   assert.ok(downloaded.includes('./media/transition-0-forward.mp4'));
   advance(1000);assert.equal(copies[0].style.transform,initial,'elapsed wall time cannot move text before decoded frames');
   video.present(.4);assert.equal(video.hidden,false);
   assert.equal(copies[0].style.transform,expectedTransform(0,transitionProgress(400,0)),'text uses the exact presented media timestamp');
   assert.match(copies[0].style.transform,/^matrix3d\(/,'moving text retains the full projective plane');
   assert.equal(copies[0].style.willChange,'transform, opacity');
   copies.filter(copy=>copy.style.visibility==='hidden').forEach(copy=>assert.equal(copy.style.willChange,'auto'));
   const frameTransform=copies[0].style.transform;advance(2000);assert.equal(copies[0].style.transform,frameTransform,'a stalled video freezes the text at the same pose');
   video.present(7.95);endLeg();visible(1);assert.equal(still.src,'./media/station-1.webp');assert.equal(video.hidden,true);
   emit(previous,'click');await flush();assert.match(video.src,/transition-0-reverse\.mp4$/);
   video.present(.4);assert.equal(copies[1].style.transform,expectedTransform(1,1-transitionProgress(400,0)),'reverse playback drives the reverse camera route');
   endLeg();visible(0);
   emit(win,'keydown',{key:'End'});await flush();
   for(let leg=0;leg<3;leg++){
    assert.match(video.src,new RegExp(`transition-${leg}-forward\\.mp4$`));
    video.present(.4);endLeg();await flush();visible(leg+1);
    assert.equal(next.disabled,true,'multi-leg navigation stays locked through its intermediate stations');
   }
   assert.equal(previous.disabled,false,'the final exact station releases the transition lock');
  }else if(scenario==='autoplay-rejection'){
   emit(next,'click');await flush();visible(1);
   assert.equal(still.src,'./media/station-1.webp');assert.equal(video.hidden,true);assert.equal(video.paused,true);
   assert.equal(next.disabled,false,'autoplay denial cannot strand navigation in a busy state');
   emit(next,'click');await flush();visible(2);
  }else if(scenario==='media-failure'){
   emit(next,'click');await flush();video.onerror();await flush();assert.match(video.src,/transition-0-forward\.webm$/,'a decode error tries the alternate format');
   video.onerror();visible(1);assert.equal(video.hidden,true);assert.equal(next.disabled,false);
   assert.equal(still.src,'./media/station-1.webp','both codec failures retain the requested text and station still');
   emit(next,'click');await flush();video.present(4);
   assert.ok(copies.every(copy=>copy.style.opacity!=='1'),'the bridge is between its stationary reading poses');
   video.onerror();await flush();visible(1);
   assert.equal(still.src,'./media/station-1.webp','a codec retry restores both the source poster and its readable text while loading');
   video.present(4);advance(12016);visible(2);
   assert.equal(still.src,'./media/station-2.webp','a prolonged network/decoder stall also completes with a still');
  }else if(scenario==='paused'||scenario==='reduced-motion'){
   if(scenario==='reduced-motion')assert.deepEqual(downloaded,[],'reduced motion does not eagerly fetch background clips');
   if(scenario==='paused')emit(play,'click');
   assert.equal(play.textContent,'Resume background');
   const frozenPoster=still.src;emit(next,'click');visible(1);
   assert.equal(video.playCalls,0);assert.equal(still.src,frozenPoster,'paused or reduced-motion navigation retains its stationary background');
   if(scenario==='paused')emit(play,'click');else{media.matches=false;emit(media,'change');}
   assert.equal(still.src,'./media/station-1.webp','resuming aligns the background with the currently selected text');
   emit(next,'click');await flush();video.present(4);emit(play,'click');visible(2);
   const frozenFrame=copies[2].style.transform,playCount=video.playCalls;
   advance(transitionDuration);assert.equal(video.playCalls,playCount);assert.equal(copies[2].style.transform,frozenFrame);
   assert.equal(next.disabled,false,'pausing mid-transition releases navigation at its selected station');
  }else if(scenario==='rounded-scroll'){
   const initial=copies[0].style.transform,transforms=[];emit(next,'click');await flush();
   const end=Math.floor(textSlideDuration/3/16)*16;
   for(let time=16;time<=end;time+=16){
    video.present(time/1000);assert.equal(scrollY,0,'departure starts within one native scroll pixel');
    transforms.push(copies[0].style.transform);
   }
   assert.ok(new Set(transforms).size>=20,'decoded frames continuously move text despite quantized native scrolling');
   const exact=transforms.at(-1);assert.notEqual(exact,initial);
   advance(1000);emit(win,'scroll');assert.equal(copies[0].style.transform,exact,'wall time and delayed native scroll cannot replace media progress');
   doc.hidden=true;emit(doc,'visibilitychange');assert.equal(video.paused,true);
   advance(14000);assert.equal(copies[0].style.transform,exact,'hidden tabs suspend the stall watchdog and retain the same frame');
   doc.hidden=false;emit(doc,'visibilitychange');assert.equal(video.paused,false);assert.equal(copies[0].style.transform,exact);
   video.present(.6);assert.notEqual(copies[0].style.transform,exact);endLeg();visible(1);
   assert.equal(scrollY,849,'the exact text stop survives a fractional anchor rounded by native scrolling');
  }else if(scenario==='rewind-cancel'){
   emit(next,'click');await flush();video.present(.4);
   const lateFrame=[...video.frames.values()][0],lateEnded=video.onended;
   emit(win,'resize');advance(32);visible(1);
   assert.equal(video.paused,true);assert.equal(still.src,'./media/station-1.webp');
   const settled=copies[1].style.transform;
   lateFrame(now,{mediaTime:2});lateEnded();assert.equal(copies[1].style.transform,settled,'callbacks canceled by resize cannot revive an earlier transition');
   const rewind=new Target('a');rewind.href='http://localhost/#name';rewind.attributes.href='#name';rewind.attributes['data-rewind']='';
   const before=video.playCalls;emit(doc,'click',{target:rewind,button:0});advance(16);
   visible(0);assert.equal(video.playCalls,before);assert.equal(still.src,'./media/station-0.webp');assert.equal(doc.activeElement,ids.name);
   emit(next,'click');await flush();video.present(.4);
   location.hash='#elsewhere';emit(win,'hashchange');visible(3);
   assert.equal(still.src,'./media/station-3.webp');assert.equal(video.paused,true,'external hash navigation cancels media and settles its exact destination');
  }
 }
 // Rotation into a short viewport restores readable ordinary document flow.
 globalThis.innerHeight=390;emit(win,'resize');advance(32);
 assert.equal(doc.documentElement.classList.contains('projected-text'),false);assert.equal(controls.hidden,true);
 copies.forEach(copy=>{assert.equal(copy.style.transform,'');assert.equal(copy.style.visibility,'');assert.equal(copy.style.willChange,'');assert.equal(copy.inert,false);});
 assert.equal(emit(win,'wheel',{deltaX:0,deltaY:80}).defaultPrevented,false,'short viewports retain ordinary scrolling');
 globalThis.innerHeight=800;emit(win,'resize');advance(32);
 assert.equal(doc.documentElement.classList.contains('projected-text'),true);assert.equal(controls.hidden,false);
 globalThis.innerWidth=390;globalThis.innerHeight=844;
 copies.forEach((copy,index)=>{copy.copyWidth=Math.min(index===0?620:360,innerWidth*.88);});
 emit(win,'resize');advance(32);
 const centered=copies.findIndex(copy=>copy.style.opacity==='1');assert.ok(centered>=0,'mobile resize retains a readable station');visible(centered);
 assert.deepEqual(errors,[]);
}
