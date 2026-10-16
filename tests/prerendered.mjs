import assert from 'node:assert/strict';
import {createPrerenderedPlayer,stationImage,transitionVideo} from '../prerendered.js';
import {transitionDuration,transitionProgress} from '../transition-timing.js';
import {portraitAspect} from '../media-settings.js';

let now=0,nextId=0,rafs=new Map(),timers=new Map();
Object.defineProperty(globalThis,'navigator',{value:{connection:{saveData:false}},configurable:true});
globalThis.requestAnimationFrame=fn=>{rafs.set(++nextId,fn);return nextId;};
globalThis.cancelAnimationFrame=id=>rafs.delete(id);
globalThis.setTimeout=(fn,ms)=>{timers.set(++nextId,{fn,at:now+ms});return nextId;};
globalThis.clearTimeout=id=>timers.delete(id);
function advance(ms){
 const end=now+ms;
 while(now<end){
  now=Math.min(end,now+16);
  for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}
  const queue=[...rafs.values()];rafs.clear();for(const fn of queue)fn(now);
 }
}
async function flush(){for(let i=0;i<6;i++)await Promise.resolve();}
class Video {
 constructor({mp4=true,frameCallbacks=true}={}){
  this.mp4=mp4;this.frames=new Map();this.loads=[];this.plays=[];this.currentTime=0;this.paused=true;this.readyState=4;this.hidden=true;
  if(!frameCallbacks)this.requestVideoFrameCallback=undefined;
 }
 canPlayType(type){return this.mp4&&type.startsWith('video/mp4')?'probably':'';}
 abortPending(){for(const play of this.plays)if(play.pending){play.pending=false;play.reject(new DOMException('Interrupted media request','AbortError'));}}
 load(){this.abortPending();this.loads.push(this.src);this.currentTime=0;}
 pause(){this.paused=true;this.abortPending();}
 play(){
  this.paused=false;let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  this.plays.push({resolve,reject,pending:true});return promise;
 }
 requestVideoFrameCallback(fn){const id=++nextId;this.frames.set(id,fn);return id;}
 cancelVideoFrameCallback(id){this.frames.delete(id);}
 present(seconds){
  const [id,fn]=this.frames.entries().next().value??[];assert.ok(fn,'a decoded frame must have a subscriber');
  this.frames.delete(id);fn(now,{mediaTime:seconds});
 }
}
function fixture(options){
 const still={},portraitSource={},video=new Video(options),progress=[],stillWrites=[],portraitWrites=[],decodes=[];
 Object.defineProperty(still,'src',{get:()=>stillWrites.at(-1),set:value=>stillWrites.push(value)});
 Object.defineProperty(portraitSource,'srcset',{get:()=>portraitWrites.at(-1),set:value=>portraitWrites.push(value)});
 if(options?.decodePoster)still.decode=()=>new Promise((resolve,reject)=>decodes.push({resolve,reject,src:still.src,portrait:portraitSource.srcset}));
 const player=createPrerenderedPlayer({still,video,portraitSource});let completions=0;
 const navigate=(from,to)=>player.navigate({from,to,onProgress:value=>progress.push(value),onComplete:()=>++completions});
 return {still,portraitSource,stillWrites,portraitWrites,decodes,video,player,progress,navigate,get completions(){return completions;}};
}

// Frame presentation timestamps, not wall time or the separate playback clock,
// drive every route leg. A dropped frame advances both layers together.
{
 const f=fixture();assert.equal(f.video.muted,true);assert.equal(f.video.playsInline,true);assert.equal(f.video.loop,false);assert.equal(f.video.preload,'auto');
 f.navigate(0,3);assert.equal(f.player.playing,true);assert.equal(f.still.src,stationImage(0));
 assert.equal(f.video.src,transitionVideo(0,1,'mp4'));assert.equal(f.video.hidden,true);
 advance(1500);assert.deepEqual(f.progress,[],'no progress is invented while the decoder has not presented a frame');
 f.video.currentTime=5;f.video.present(.4);
 assert.equal(f.progress.at(-1),transitionProgress(400,0),'the presented PTS wins over currentTime');
 assert.equal(f.video.hidden,false);
 const count=f.progress.length;advance(2000);assert.equal(f.progress.length,count,'stalled media never receives extrapolated progress');
 f.video.present(4.3);assert.equal(f.progress.at(-1),transitionProgress(4300,0));
 const oldFrame=[...f.video.frames.values()][0],oldEnded=f.video.onended;f.video.onended();
 assert.equal(f.progress.at(-1),1);assert.equal(f.still.src,stationImage(1));assert.equal(f.video.src,transitionVideo(1,1,'mp4'));
 const atHandoff=f.progress.length;oldEnded();assert.equal(f.progress.length,atHandoff,'an old ended event cannot skip the next clip');oldFrame(now,{mediaTime:6});assert.equal(f.progress.length,atHandoff,'an old leg callback cannot update the next leg');
 await flush();assert.equal(f.player.playing,true,'load-induced rejection from the previous leg cannot abort the next leg');
 f.video.present(.4);assert.equal(f.progress.at(-1),1+transitionProgress(400,1));
 f.video.onended();assert.equal(f.progress.at(-1),2);assert.equal(f.completions,0);
 f.video.present((transitionDuration-16)/1000);f.video.onended();
 assert.equal(f.progress.at(-1),3);assert.equal(f.completions,1);assert.equal(f.player.playing,false);
 assert.equal(f.video.hidden,true);assert.equal(f.still.src,stationImage(3),'the endpoint is exact even if the last encoded frame precedes it');
 await flush();assert.equal(f.completions,1);f.player.destroy();
}

// Reverse clips have positive playback time and the opposite route orientation.
{
 const f=fixture({mp4:false});f.navigate(3,0);
 for(let leg=2;leg>=0;leg--){
  assert.equal(f.video.src,transitionVideo(leg,-1,'webm'));
  f.video.present(.4);assert.equal(f.progress.at(-1),leg+1-transitionProgress(400,leg));
  f.video.onended();assert.equal(f.progress.at(-1),leg);
 }
 assert.equal(f.completions,1);assert.equal(f.still.src,stationImage(0));await flush();f.player.destroy();
}

// Loading a codec fallback rejects the old play promise in real browsers.
{
 const f=fixture();f.navigate(0,1);
 const oldFrame=[...f.video.frames.values()][0];f.video.onerror();
 assert.equal(f.video.src,transitionVideo(0,1,'webm'));
 await flush();assert.equal(f.player.playing,true);assert.equal(f.completions,0,'the aborted MP4 play promise cannot cancel the WebM attempt');
 oldFrame(now,{mediaTime:3});assert.deepEqual(f.progress,[0],'retry aligns the text with its source poster while the alternate clip loads');
 f.video.present(.4);assert.equal(f.progress.at(-1),transitionProgress(400,0));
 f.video.onerror();assert.equal(f.player.playing,false);assert.equal(f.completions,1);assert.equal(f.still.src,stationImage(1));
 await flush();assert.equal(f.completions,1);f.player.destroy();
}

// A hidden tab suspends both the player and its download timeout. Its pending
// play rejection is deliberate; returning to the tab resumes the same clip.
{
 const f=fixture();f.navigate(1,2);f.video.present(.4);
 const before=f.progress.at(-1),source=f.video.src,loadCount=f.video.loads.length;
 f.player.setHidden(true);await flush();assert.equal(f.video.paused,true);assert.equal(f.player.playing,true);
 advance(20000);assert.equal(f.completions,0);assert.equal(f.progress.at(-1),before);
 f.player.setHidden(false);assert.equal(f.video.paused,false);assert.equal(f.video.src,source);assert.equal(f.video.loads.length,loadCount,'resuming never reloads or seeks the media');
 f.video.present(.6);assert.equal(f.progress.at(-1),1+transitionProgress(600,1));
 f.video.onended();await flush();assert.equal(f.completions,1);f.player.destroy();
}

// Canceling, changing station, and destroying invalidate every queued callback.
{
 const f=fixture();const cancel=f.navigate(0,1);f.video.present(.4);
 const frame=[...f.video.frames.values()][0],ended=f.video.onended,error=f.video.onerror;
 const count=f.progress.length;cancel();cancel();frame(now,{mediaTime:3});ended();error();await flush();advance(14000);
 assert.equal(f.progress.length,count);assert.equal(f.completions,0);assert.equal(f.player.playing,false);
 f.navigate(1,2);const replacedFrame=[...f.video.frames.values()][0];f.player.showStation(3);
 replacedFrame(now,{mediaTime:4});assert.equal(f.still.src,stationImage(3));assert.equal(f.video.hidden,true);assert.equal(f.completions,0);
 f.navigate(3,2);const destroyedFrame=[...f.video.frames.values()][0];f.player.destroy();destroyedFrame(now,{mediaTime:7});await flush();
 assert.equal(f.player.playing,false);assert.equal(f.completions,0);
}

// Autoplay rejection and a download that never produces a frame settle the
// requested still exactly once, so navigation can release its gesture lock.
{
 const f=fixture();f.navigate(0,2);f.video.plays.at(-1).reject(new DOMException('Playback denied','NotAllowedError'));await flush();
 assert.deepEqual(f.progress,[2]);assert.equal(f.completions,1);assert.equal(f.still.src,stationImage(2));assert.equal(f.video.hidden,true);
 f.navigate(2,3);advance(12016);assert.equal(f.progress.at(-1),3);assert.equal(f.completions,2);assert.equal(f.still.src,stationImage(3));await flush();f.player.destroy();
}

// Browsers without frame callbacks still use the media clock, and honor data
// saving preference without requiring video playback for a station still.
{
 navigator.connection.saveData=true;
 const f=fixture({frameCallbacks:false});assert.equal(f.video.preload,'metadata');f.player.showStation(0);assert.equal(f.video.plays.length,0);
 f.navigate(0,1);f.video.currentTime=.4;advance(16);assert.equal(f.progress.at(-1),transitionProgress(400,0));
 const fixed=f.progress.at(-1);advance(1000);assert.equal(f.progress.at(-1),fixed,'RAF fallback samples currentTime without integrating wall time');
 f.video.readyState=1;f.video.currentTime=.8;advance(16);assert.equal(f.progress.at(-1),fixed,'an unavailable frame cannot advance the fallback clock');
 f.video.readyState=4;f.video.currentTime=.4;advance(12016);
 assert.equal(f.completions,1,'duplicate RAF samples of a stalled media clock must not postpone the download timeout');
 assert.equal(f.still.src,stationImage(1));
 f.player.destroy();await flush();navigator.connection.saveData=false;
}
// Portrait selection agrees with the picture breakpoint, including its exact
// boundary. Poster preloads always match the active clip's crop and direction.
{
 const preloads=[];
 globalThis.Image=class {constructor(){preloads.push(this);}};
 assert.equal(portraitAspect,3/4);
 for(const [width,height,portrait] of [[390,844,true],[600,800,true],[601,800,false],[1280,800,false]]){
  globalThis.innerWidth=width;globalThis.innerHeight=height;
  const f=fixture();f.player.showStation(0);
  assert.equal(f.still.src,stationImage(0));assert.equal(f.portraitSource.srcset,stationImage(0,true),'picture sources identify the same station for either viewport');
  f.player.showStation(0);assert.equal(f.stillWrites.length,1);assert.equal(f.portraitWrites.length,1,'repeated station updates avoid restarting image selection');
  f.navigate(0,2);assert.equal(f.video.src,transitionVideo(0,1,'mp4',portrait));
  assert.equal(preloads.at(-1).src,stationImage(1,portrait));assert.equal(preloads.at(-1).fetchPriority,'low');
  f.video.onerror();assert.equal(f.video.src,transitionVideo(0,1,'webm',portrait),'format retry preserves the selected responsive variant');
  f.video.present(.4);assert.equal(f.progress.at(-1),transitionProgress(400,0),'responsive crops share the same camera clock');
  f.video.onended();assert.equal(f.still.src,stationImage(1));assert.equal(f.portraitSource.srcset,stationImage(1,true));
  assert.equal(f.video.src,transitionVideo(1,1,'mp4',portrait));assert.equal(preloads.at(-1).src,stationImage(2,portrait));
  f.video.onended();assert.equal(f.portraitSource.srcset,stationImage(2,true));
  f.navigate(2,1);assert.equal(f.video.src,transitionVideo(1,-1,'mp4',portrait));assert.equal(preloads.at(-1).src,stationImage(1,portrait));
  f.video.onended();assert.equal(f.portraitSource.srcset,stationImage(1,true));await flush();f.player.destroy();
 }
 // The app settles on resize, then the next navigation chooses the new master.
 globalThis.innerWidth=390;globalThis.innerHeight=844;
 const f=fixture();f.navigate(0,1);const oldFrame=[...f.video.frames.values()][0];
 globalThis.innerWidth=1280;globalThis.innerHeight=800;f.player.showStation(1);
 const settled=f.progress.length;oldFrame(now,{mediaTime:5});assert.equal(f.progress.length,settled);
 f.navigate(1,2);assert.equal(f.video.src,transitionVideo(1,1,'mp4',false));assert.equal(preloads.at(-1).src,stationImage(2,false));
 f.player.destroy();await flush();delete globalThis.Image;delete globalThis.innerWidth;delete globalThis.innerHeight;
}

// Unsupported codecs may surface through play() before, or together with, an
// error event. Either ordering must spend exactly one alternate-format retry.
{
 const f=fixture();f.navigate(0,1);
 const firstError=f.video.onerror;
 f.video.plays.at(-1).reject(new DOMException('Unsupported media format','NotSupportedError'));await flush();
 assert.equal(f.video.src,transitionVideo(0,1,'webm'),'an unsupported play promise should try the alternate codec');
 assert.equal(f.completions,0);firstError();
 assert.equal(f.completions,0,'a duplicate event from the first codec cannot consume the alternate attempt');
 f.video.present(.4);assert.equal(f.progress.at(-1),transitionProgress(400,0));
 f.video.plays.at(-1).reject(new DOMException('Alternate codec unsupported','NotSupportedError'));await flush();
 assert.equal(f.completions,1);assert.equal(f.still.src,stationImage(1));f.player.destroy();

 const g=fixture();g.navigate(0,1);
 g.video.plays.at(-1).reject(new DOMException('Unsupported media format','NotSupportedError'));g.video.onerror();await flush();
 assert.equal(g.video.src,transitionVideo(0,1,'webm'));assert.equal(g.completions,0,'an error event before rejection handling must not retry twice');
 g.video.onended();await flush();assert.equal(g.completions,1);g.player.destroy();
}
// Updating a picture URL does not mean that its new image can be painted yet.
// Hold the completed video, and its text pose, until destination decoding ends.
{
 const f=fixture({decodePoster:true});f.navigate(0,1);
 assert.equal(f.video.loads.length,0,'the source station decodes before loading a clip can clear the retained video');
 f.decodes.at(-1).resolve();await flush();assert.equal(f.video.loads.length,1);
 f.video.present(7.9);const priorPose=f.progress.at(-1),lateFrame=[...f.video.frames.values()][0],lateEnded=f.video.onended;
 f.video.onended();assert.equal(f.still.src,stationImage(1));assert.equal(f.video.hidden,false,'the previous decoded poster stays covered during the handoff');
 assert.equal(f.progress.at(-1),priorPose);assert.equal(f.completions,0,'completion waits for the destination picture');
 lateFrame(now,{mediaTime:2});lateEnded();assert.equal(f.progress.at(-1),priorPose,'late callbacks cannot inject an old video pose during poster decoding');
 assert.equal(f.decodes.length,2,'a duplicate ended callback cannot restart the handoff');
 f.decodes.at(-1).resolve();await flush();
 assert.equal(f.video.hidden,true);assert.equal(f.progress.at(-1),1);assert.equal(f.completions,1);
 f.player.destroy();
}

// A multi-leg jump must not call video.load() until its intermediate poster is
// ready: load clears the very video frame that hides the previous poster.
{
 const f=fixture({decodePoster:true});f.navigate(0,2);f.decodes.at(-1).resolve();await flush();
 f.video.present(7.9);f.video.onended();assert.equal(f.video.loads.length,1);assert.equal(f.video.hidden,false);
 f.decodes.at(-1).resolve();await flush();assert.equal(f.video.loads.length,2);assert.equal(f.video.hidden,true);
 assert.equal(f.progress.at(-1),1);assert.equal(f.completions,0);
 f.video.present(.4);assert.equal(f.video.hidden,false);f.video.onended();
 assert.equal(f.video.hidden,false);f.decodes.at(-1).resolve();await flush();assert.equal(f.video.hidden,true);assert.equal(f.completions,1);
 f.player.destroy();
}

// Decode promises cannot be canceled, so a completed stale request must never
// expose a picture or resume playback after a newer station has been selected.
{
 const f=fixture({decodePoster:true});f.navigate(0,1);f.decodes.at(-1).resolve();await flush();
 f.video.present(7.9);f.video.onended();const obsolete=f.decodes.at(-1);
 f.player.showStation(3);const current=f.decodes.at(-1);
 obsolete.resolve();await flush();assert.equal(f.video.hidden,false);assert.equal(f.completions,0);assert.equal(f.still.src,stationImage(3));
 current.resolve();await flush();assert.equal(f.video.hidden,true);assert.equal(f.completions,0);
 f.navigate(3,2);f.video.present(.4);f.video.onended();const canceled=f.decodes.at(-1);f.player.freeze();
 canceled.resolve();await flush();assert.equal(f.video.hidden,false,'freezing keeps the chosen video frame even if a canceled image later decodes');
 assert.equal(f.completions,0);f.player.destroy();
}

// Visibility changes may occur while any station poster is still decoding.
// Resuming at those boundaries must not replay the video element's old source.
{
 const f=fixture({decodePoster:true});f.video.src='./media/previous-navigation.mp4';f.navigate(0,2);
 f.player.setHidden(true);f.player.setHidden(false);await flush();
 assert.equal(f.video.plays.length,0,'showing the tab during initial poster decoding cannot replay a previously loaded source');
 assert.equal(f.video.loads.length,0);
 f.decodes.at(-1).resolve();await flush();assert.equal(f.video.plays.length,1);assert.equal(f.video.loads.length,1);
 f.video.present(7.9);f.video.onended();
 const firstClip=f.video.src;f.player.setHidden(true);f.player.setHidden(false);await flush();
 assert.equal(f.video.plays.length,1,'showing the tab during an intermediate poster handoff cannot restart the ended clip');
 assert.equal(f.video.src,firstClip);assert.equal(f.video.loads.length,1);
 f.decodes.at(-1).resolve();await flush();assert.equal(f.video.plays.length,2);assert.equal(f.video.loads.length,2);
 assert.equal(f.video.src,transitionVideo(1,1,'mp4'));
 f.video.present(7.9);f.video.onended();f.player.setHidden(true);f.player.setHidden(false);await flush();
 assert.equal(f.video.plays.length,2,'showing the tab during final poster decoding cannot replay the final clip');
 assert.equal(f.completions,0);f.decodes.at(-1).resolve();await flush();
 assert.equal(f.completions,1);assert.equal(f.video.hidden,true);assert.equal(f.video.plays.length,2);f.player.destroy();
}

// A failed or stalled poster still releases navigation and leaves the retained
// video visible; it must never reveal an old picture while pretending it is new.
{
 const f=fixture({decodePoster:true});f.navigate(0,1);f.decodes.at(-1).resolve();await flush();
 f.video.present(7.9);f.video.onended();f.decodes.at(-1).reject(new Error('Image could not decode'));await flush();
 assert.equal(f.video.hidden,false);assert.equal(f.progress.at(-1),1);assert.equal(f.completions,1);f.player.destroy();
 const g=fixture({decodePoster:true});g.navigate(0,1);g.decodes.at(-1).resolve();await flush();
 g.video.present(7.9);g.video.onended();advance(12016);
 assert.equal(g.video.hidden,false);assert.equal(g.progress.at(-1),1);assert.equal(g.completions,1,'a stalled poster cannot lock the page indefinitely');
 g.decodes.at(-1).resolve();await flush();assert.equal(g.completions,1);g.player.destroy();
}
console.log('Prerendered player: presented-frame clock, reverse/multi-leg clips, decoded poster handoffs, exact endpoints, codec fallback, promise races, hidden tabs, cancellation, responsive sources/preloads, autoplay/timeouts and legacy media-clock fallback passed.');
