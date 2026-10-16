// A gesture selects a reading pose; scrolling only occurs during its transition.
const sections=[...document.querySelectorAll('main > section')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const interactive='a,button,input,select,textarea,summary,details';
let active=0,moving=false,wheelUntil=0,touch=null;
const position=i=>Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,scrollY+sections[i].getBoundingClientRect().top+(sections[i].offsetHeight-innerHeight)/2));
function nearest(){return sections.reduce((best,_,i)=>Math.abs(position(i)-scrollY)<Math.abs(position(best)-scrollY)?i:best,0);}
function go(i){
 if(moving)return;
 active=Math.max(0,Math.min(sections.length-1,i));
 const start=scrollY,end=position(active),duration=reduced.matches?0:1100;
 if(Math.abs(end-start)<1)return;
 moving=true;const began=performance.now();
 function step(now){const t=duration?Math.min(1,(now-began)/duration):1;const ease=t*t*t*(t*(t*6-15)+10);window.scrollTo(0,start+(end-start)*ease);if(t<1)requestAnimationFrame(step);else moving=false;}
 requestAnimationFrame(step);
}
window.addEventListener('wheel',e=>{
 if(e.ctrlKey||e.target.closest('select,textarea'))return;
 e.preventDefault();const now=performance.now(),continuing=now<wheelUntil;wheelUntil=now+220;
 if(!moving&&!continuing&&Math.abs(e.deltaY)>2)go(nearest()+Math.sign(e.deltaY));
},{passive:false});
window.addEventListener('touchstart',e=>{if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY,target:e.target};},{passive:true});
window.addEventListener('touchmove',e=>{if(touch&&!touch.target.closest(interactive)&&e.touches.length===1)e.preventDefault();},{passive:false});
window.addEventListener('touchend',e=>{
 if(!touch)return;const origin=touch;touch=null;
 if(origin.target.closest(interactive)||!e.changedTouches.length)return;
 const dy=origin.y-e.changedTouches[0].clientY;
 if(Math.abs(dy)>35){e.preventDefault();go(nearest()+Math.sign(dy));}
},{passive:false});
document.addEventListener('click',e=>{
 if(e.target.closest(interactive)||getSelection()?.toString())return;
 go(nearest()+1);
});
window.addEventListener('keydown',e=>{
 if(e.target.closest(interactive)||e.altKey||e.ctrlKey||e.metaKey)return;
 const direction={ArrowDown:1,PageDown:1,' ':e.shiftKey?-1:1,ArrowUp:-1,PageUp:-1}[e.key];
 if(direction){e.preventDefault();go(nearest()+direction);}
 else if(e.key==='Home'||e.key==='End'){e.preventDefault();go(e.key==='Home'?0:sections.length-1);}
});
window.addEventListener('resize',()=>{if(!moving)window.scrollTo(0,position(active));});
active=nearest();

