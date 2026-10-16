// A gesture selects one reading pose; its momentum cannot select a second pose.
const interactive='a,button,input,select,textarea,summary,details,[contenteditable="true"]';
const editable='input,select,textarea,[contenteditable="true"]';
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

export class WheelIntent {
 constructor(){this.last=-Infinity;this.total=0;this.consumed=false;}
 push(delta,time,blocked=false){
  if(time-this.last>240){this.total=0;this.consumed=false;}
  this.last=time;
  if(blocked){this.total=0;this.consumed=true;return 0;}
  if(this.consumed||!delta)return 0;
  if(Math.sign(delta)!==Math.sign(this.total))this.total=0;
  this.total+=delta;
  if(Math.abs(this.total)<40)return 0;
  this.consumed=true;
  return Math.sign(this.total);
 }
}

export function initSectionNavigation({isEnabled=()=>true,onChange=()=>{}}={}){
 const sections=[...document.querySelectorAll('main > section')];
 if(!sections.length)return null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),wheel=new WheelIntent();
 const listeners=[];
 let active=0,moving=false,animation=0,resizeFrame=0,touch=null,multiTouch=false,ignoreClickUntil=0,destroyed=false;
 const oldRestoration=history.scrollRestoration;
 history.scrollRestoration='manual';
 const position=i=>{
  if(i===0)return 0;
  const rect=sections[i].getBoundingClientRect();
  return clamp(scrollY+rect.top+(rect.height-innerHeight)/2,0,Math.max(0,document.documentElement.scrollHeight-innerHeight));
 };
 const nearest=()=>sections.reduce((best,_,i)=>Math.abs(position(i)-scrollY)<Math.abs(position(best)-scrollY)?i:best,0);
 const sectionForHash=hash=>{
  if(!hash||hash==='#')return 0;
  let id;try{id=decodeURIComponent(hash.slice(1));}catch{return -1;}
  const section=document.getElementById(id)?.closest('main > section');
  return sections.indexOf(section);
 };
 const hashFor=i=>'#'+(sections[i].id||sections[i].getAttribute('aria-labelledby')||'');
 const controls=document.createElement('nav');controls.className='section-controls';controls.setAttribute('aria-label','Section navigation');
 const previous=document.createElement('button');previous.type='button';previous.textContent='←';previous.setAttribute('aria-label','Previous section');
 const counter=document.createElement('span');counter.className='section-counter';counter.setAttribute('aria-live','polite');counter.setAttribute('aria-atomic','true');
 const next=document.createElement('button');next.type='button';next.textContent='→';next.setAttribute('aria-label','Next section');
 controls.append(previous,counter,next);document.body.append(controls);
 function updateControls(){
  controls.hidden=!isEnabled();previous.disabled=active===0||moving;next.disabled=active===sections.length-1||moving;
  counter.textContent=`${active+1} / ${sections.length}`;
  counter.setAttribute('aria-label',`Section ${active+1} of ${sections.length}`);
 }
 function stop(){cancelAnimationFrame(animation);animation=0;moving=false;}
 function goTo(index,{immediate=false,updateHash=true,interrupt=false}={}){
  if(destroyed||!isEnabled()||(moving&&!interrupt))return false;
  stop();active=clamp(index,0,sections.length-1);
  const start=scrollY,end=position(active),duration=immediate||reduced.matches?0:1450;
  if(updateHash)history.replaceState(history.state,'',hashFor(active));
  onChange(active);document.dispatchEvent(new CustomEvent('sectionchange',{detail:{index:active}}));
  if(!duration||Math.abs(end-start)<.25){window.scrollTo(0,end);updateControls();return true;}
  moving=true;updateControls();const began=performance.now();
  function step(now){
   if(destroyed||!isEnabled()){stop();updateControls();return;}
   const t=Math.min(1,(now-began)/duration),ease=t*t*t*(t*(t*6-15)+10);
   window.scrollTo(0,start+(end-start)*ease);
   if(t<1)animation=requestAnimationFrame(step);
   else{moving=false;animation=0;updateControls();}
  }
  animation=requestAnimationFrame(step);return true;
 }
 function refresh(){
  if(destroyed)return;
  stop();
  if(isEnabled())goTo(active,{immediate:true,updateHash:false});
  else updateControls();
 }
 const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
 on(previous,'click',()=>goTo(active-1));on(next,'click',()=>goTo(active+1));
 on(window,'wheel',event=>{
  if(!isEnabled()||event.ctrlKey||event.target.closest(editable)||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  event.preventDefault();
  const unit=event.deltaMode===1?16:event.deltaMode===2?innerHeight:1;
  const direction=wheel.push(event.deltaY*unit,performance.now(),moving);
  if(direction)goTo(active+direction);
 },{passive:false});
 on(window,'touchstart',event=>{
  if(!isEnabled())return;
  if(event.touches.length!==1){multiTouch=true;touch=null;return;}
  if(multiTouch)return;
  const point=event.touches[0];
  touch=event.target.closest(interactive)?null:{x:point.clientX,y:point.clientY};
 },{passive:true});
 on(window,'touchmove',event=>{
  if(event.touches.length!==1){multiTouch=true;touch=null;return;}
  if(isEnabled()&&touch&&!multiTouch&&event.cancelable)event.preventDefault();
 },{passive:false});
 on(window,'touchend',event=>{
  if(multiTouch){if(!event.touches.length)multiTouch=false;touch=null;ignoreClickUntil=performance.now()+450;return;}
  const origin=touch;touch=null;
  if(!isEnabled()||!origin||!event.changedTouches.length)return;
  const point=event.changedTouches[0],dx=origin.x-point.clientX,dy=origin.y-point.clientY;
  if(Math.max(Math.abs(dx),Math.abs(dy))>35){
   if(event.cancelable)event.preventDefault();
   ignoreClickUntil=performance.now()+450;
   goTo(active+Math.sign(Math.abs(dy)>=Math.abs(dx)?dy:dx));
  }
 },{passive:false});
 on(window,'touchcancel',()=>{touch=null;multiTouch=false;ignoreClickUntil=performance.now()+450;});
 on(document,'click',event=>{
  if(!isEnabled()||performance.now()<ignoreClickUntil||event.defaultPrevented||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const link=event.target.closest('a[href]');
  if(link){
   const url=new URL(link.href,location.href);
   if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search&&(url.hash||link.getAttribute('href')==='#')){
    const index=sectionForHash(url.hash);
    if(index>=0){event.preventDefault();if(!moving){history.pushState(history.state,'',url.hash||'#');goTo(index,{updateHash:false});}}
   }
   return;
  }
  if(event.target.closest(interactive)||getSelection()?.toString())return;
  goTo(active+1);
 });
 on(window,'keydown',event=>{
  if(!isEnabled()||event.defaultPrevented||event.target.closest('button,input,select,textarea,summary,[contenteditable="true"]')||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.shiftKey&&event.key!==' ')return;
  const direction={ArrowDown:1,ArrowRight:1,PageDown:1,' ':event.shiftKey?-1:1,ArrowUp:-1,ArrowLeft:-1,PageUp:-1}[event.key];
  if(!direction&&event.key!=='Home'&&event.key!=='End')return;
  event.preventDefault();if(event.repeat)return;
  goTo(event.key==='Home'?0:event.key==='End'?sections.length-1:active+direction);
 });
 on(document,'focusin',event=>{
  if(!isEnabled())return;
  const section=event.target.closest('main > section');
  const index=section?sections.indexOf(section):event.target.closest('header')?0:event.target.closest('footer')?sections.length-1:-1;
  if(index>=0&&index!==active)goTo(index,{immediate:true,interrupt:true});
 });
 const followHash=()=>{if(!isEnabled())return;const index=sectionForHash(location.hash);if(index>=0)goTo(index,{immediate:true,updateHash:false,interrupt:true});};
 on(window,'hashchange',followHash);
 on(window,'popstate',followHash);
 on(window,'resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(refresh);});
 on(reduced,'change',refresh);
 const initial=sectionForHash(location.hash);active=initial>=0?initial:nearest();refresh();
 return {goTo,refresh,get active(){return active;},destroy(){destroyed=true;stop();cancelAnimationFrame(resizeFrame);listeners.forEach(remove=>remove());controls.remove();history.scrollRestoration=oldRestoration;}};
}
