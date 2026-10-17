import {projectText,initTextSprites,setTextProjection} from './text-sprites.js?v=prerendered-60-1';
import {initSectionNavigation} from './section-navigation.js?v=local-slides-3';
import {readingPhase} from './camera-path.js';
import {createPrerenderedPlayer} from './prerendered.js?v=suspended-text-7';
import {createTextSuspension} from './text-suspension.js';
const play=document.querySelector('#play');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const player=createPrerenderedPlayer({still:document.querySelector('#background-still'),video:document.querySelector('#background-video'),portraitSource:document.querySelector('#background-portrait')});
let running=!reduced.matches,phase=0,navigation=null;
const textMotion=createTextSuspension(projectText);
function updateText(immediate=false){textMotion.set(running?phase:readingPhase(navigation?.active??0),{immediate:immediate||!running||!document.documentElement.classList.contains('projected-text')});}
function reportProgress(value){
 phase=readingPhase(value);updateText(!player.playing&&Number.isInteger(value));
 if(running&&!player.playing&&Number.isInteger(value))player.showStation(value);
}
function state(){play.textContent=running?'Pause background':'Resume background';play.setAttribute('aria-pressed',String(running));}
function resize(){
 const fit=[...document.querySelectorAll('.reading-copy')].every(copy=>copy.offsetHeight<=innerHeight-160);
 setTextProjection(fit);navigation?.refresh();updateText(true);
}
function changeMotion(value){
 running=value;player.freeze();navigation?.refresh();
 if(running)player.showStation(navigation?.active??0);
 updateText(true);state();
}
async function main(){
 const yearLabel=document.querySelector('#copyright-year');
 if(yearLabel)yearLabel.textContent=String(new Date().getFullYear());
 await document.fonts.ready;
 initTextSprites();
 navigation=initSectionNavigation({
  isEnabled:()=>document.documentElement.classList.contains('projected-text'),
  onChange:()=>updateText(),onProgress:reportProgress,
  animateTransition:options=>{
   if(!running){options.onProgress(options.to);options.onComplete();return()=>{};}
   return player.navigate(options);
  }
 });
 resize();phase=readingPhase(navigation?.active??0);player.showStation(navigation?.active??0);updateText(true);state();
 window.addEventListener('resize',resize);
 play.addEventListener('click',()=>changeMotion(!running));
 reduced.addEventListener('change',()=>changeMotion(!reduced.matches));
 document.addEventListener('visibilitychange',()=>{player.setHidden(document.hidden);if(document.hidden)updateText(true);});
 // In document-flow fallback the background rests at the nearest section.
 window.addEventListener('scroll',()=>{
  if(document.documentElement.classList.contains('projected-text')||!running)return;
  const sections=[...document.querySelectorAll('main > section')];
  const index=sections.reduce((best,section,i)=>Math.abs(section.getBoundingClientRect().top+section.offsetHeight/2-innerHeight/2)<Math.abs(sections[best].getBoundingClientRect().top+sections[best].offsetHeight/2-innerHeight/2)?i:best,0);
  player.showStation(index);
 },{passive:true});
}
main().catch(error=>{console.error(error);player.freeze();setTextProjection(false);});
