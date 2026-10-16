import assert from 'node:assert/strict';
import {WheelIntent,initSectionNavigation} from '../section-navigation.js';

// Trackpad deltas accumulate, while all momentum in one gesture is consumed.
const intent=new WheelIntent();
for(let i=0;i<19;i++)assert.equal(intent.push(2,i*10),0);
assert.equal(intent.push(2,190),1);
for(let time=200;time<1800;time+=100)assert.equal(intent.push(100,time,time<1200),0);
assert.equal(intent.push(-40,2100),-1);
const reversing=new WheelIntent();
assert.equal(reversing.push(30,0),0);assert.equal(reversing.push(-30,20),0);assert.equal(reversing.push(-10,40),-1);

// A small browser fixture exercises the public initializer and actual handlers.
let now=0,rafId=0,rafs=new Map();
class Target {
 constructor(kind=''){this.kind=kind;this.listeners=new Map();this.attributes={};this.children=[];}
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
const win=new Target(),doc=new Target(),media=new Target();media.matches=false;
globalThis.window=win;globalThis.document=doc;globalThis.innerHeight=800;globalThis.scrollY=0;
globalThis.performance={now:()=>now};globalThis.matchMedia=()=>media;globalThis.getSelection=()=>({toString:()=>''});
globalThis.requestAnimationFrame=fn=>{rafs.set(++rafId,fn);return rafId;};globalThis.cancelAnimationFrame=id=>rafs.delete(id);
globalThis.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail;}};
const location=new URL('http://localhost/#current-title');globalThis.location=location;
globalThis.history={state:null,scrollRestoration:'auto',replaceState(_,unused,url){location.href=new URL(url,location).href;},pushState(_,unused,url){location.href=new URL(url,location).href;}};
win.scrollTo=(_,y)=>{globalThis.scrollY=y;};
doc.body=new Target('body');doc.documentElement={scrollHeight:3250};doc.createElement=kind=>new Target(kind);
const geometry=[[84,760],[848.5,801.5],[1650,800.25],[2450,800]];
const sections=geometry.map(([top,height],index)=>{
 const section=new Target('section');section.id=['','background','','elsewhere'][index];section.attributes['aria-labelledby']=['name','background-title','current-title','elsewhere-title'][index];
 section.getBoundingClientRect=()=>({top:geometry[index][0]-scrollY,height:geometry[index][1]});return section;
});
const ids=Object.fromEntries(sections.flatMap(section=>{
 const heading=new Target('h2');heading.section=section;section.section=section;
 return [[section.attributes['aria-labelledby'],heading],...(section.id?[[section.id,section]]:[])];
}));
doc.querySelectorAll=()=>sections;doc.getElementById=id=>ids[id];
function emit(target,type,props={}){
 const event={type,target:doc.body,defaultPrevented:false,cancelable:true,preventDefault(){this.defaultPrevented=true;},...props};
 target.dispatchEvent(event);return event;
}
function advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+16);const queue=[...rafs.values()];rafs.clear();for(const fn of queue)fn(now);}}
let enabled=true;
const nav=initSectionNavigation({isEnabled:()=>enabled});
assert.equal(nav.active,2,'a heading hash selects its containing section');
assert.equal(scrollY,1650.125,'fractional section heights retain precise center positions');
nav.goTo(0,{immediate:true});assert.equal(scrollY,0,'opening pose leaves header visible');
nav.goTo(1);assert.equal(nav.goTo(2),false,'transitions cannot be interrupted by another gesture');
advance(1200);assert.equal(scrollY,849.25);
assert.equal(emit(win,'keydown',{key:'ArrowDown',repeat:true}).defaultPrevented,true);assert.equal(nav.active,1);
const link=new Target('a');emit(win,'keydown',{key:'PageDown',target:link});assert.equal(nav.active,2,'paging works while a link is focused');advance(1200);
const input=new Target('input');assert.equal(emit(win,'keydown',{key:'Home',target:input}).defaultPrevented,false);assert.equal(nav.active,2);
assert.equal(emit(win,'wheel',{deltaY:100,deltaX:0,ctrlKey:true}).defaultPrevented,false,'pinch/zoom is not intercepted');
// A second finger invalidates the first-finger swipe through all touchend events.
emit(win,'touchstart',{touches:[{clientX:100,clientY:100}]});
emit(win,'touchstart',{touches:[{clientX:100,clientY:100},{clientX:150,clientY:100}]});
emit(win,'touchend',{touches:[{clientX:100,clientY:10}],changedTouches:[{clientX:150,clientY:10}]});
emit(win,'touchend',{touches:[],changedTouches:[{clientX:100,clientY:10}]});assert.equal(nav.active,2);
emit(win,'touchstart',{touches:[{clientX:100,clientY:100}]});emit(win,'touchcancel');
emit(win,'touchend',{touches:[],changedTouches:[{clientX:100,clientY:10}]});assert.equal(nav.active,2);
location.hash='#background';emit(win,'hashchange');assert.equal(nav.active,1);assert.equal(scrollY,849.25);
geometry[1][0]=880;emit(win,'resize');advance(16);assert.equal(scrollY,880.75,'resize reanchors the current section');
emit(doc,'focusin',{target:new Target('footer')});assert.equal(nav.active,3,'footer focus synchronizes the selected section');
emit(doc,'focusin',{target:new Target('header')});assert.equal(nav.active,0,'header focus restores the opening section');
enabled=false;nav.refresh();assert.equal(emit(win,'wheel',{deltaY:100,deltaX:0}).defaultPrevented,false,'static fallback keeps ordinary scrolling');
assert.equal(doc.body.children[0].hidden,true);
enabled=true;nav.refresh();media.matches=true;emit(media,'change');nav.goTo(3);assert.equal(scrollY,2450,'reduced-motion navigation is immediate');
nav.destroy();assert.equal(history.scrollRestoration,'auto');
console.log('Section navigation: precise poses, atomic gestures, momentum, hashes, touch cancellation, keyboard, resize and static/reduced-motion fallbacks passed.');
