import {transitionProgress,transitionDuration} from './transition-timing.js';
import {portraitAspect} from './media-settings.js';
export {masterAspect} from './media-settings.js';

export const stationImage=(index,portrait=false)=>`./media/station-${index}${portrait?'-portrait':''}.webp`;
export const transitionVideo=(leg,direction,format,portrait=false)=>`./media/transition-${leg}-${direction>0?'forward':'reverse'}${portrait?'-portrait':''}.${format}`;

// The decoded video frame is the clock for both text and section progress.
// A slow decoder or a stalled download therefore cannot leave the text ahead.
export function createPrerenderedPlayer({still,video,portraitSource}){
 let cancelCurrent=null,playing=false,hidden=false;
 video.muted=true;video.playsInline=true;video.loop=false;
 video.preload=navigator.connection?.saveData?'metadata':'auto';
 const preferred=video.canPlayType('video/mp4; codecs="avc1.42E029"')?'mp4':'webm';
 let shown=-1,readyPoster='',posterGeneration=0,posterTimer=0;
 const portraitViewport=()=>typeof innerWidth==='number'&&typeof innerHeight==='number'&&innerWidth/innerHeight<=portraitAspect;
 function cancelPoster(){++posterGeneration;clearTimeout(posterTimer);posterTimer=0;}
 function showStill(index,onReady=()=>{}){
  cancelPoster();
  const generation=posterGeneration,key=`${index}:${portraitViewport()}`;
  if(shown!==index){
   shown=index;readyPoster='';
   if(portraitSource)portraitSource.srcset=stationImage(index,true);
   still.src=stationImage(index);
  }
  const finish=decoded=>{
   if(generation!==posterGeneration)return;
   clearTimeout(posterTimer);posterTimer=0;++posterGeneration;
   // Keep the completed video frame above the picture until the newly selected
   // picture source is decoded. Changing src alone can still paint the old image.
   if(decoded){readyPoster=key;video.hidden=true;}
   onReady(decoded);
  };
  if(readyPoster===key||typeof still.decode!=='function'){finish(true);return;}
  // A missing image must not leave the section navigation locked indefinitely.
  posterTimer=setTimeout(()=>finish(false),12000);
  try{still.decode().then(()=>finish(true),()=>finish(false));}catch{finish(false);}
 }
 function showStation(index){cancelCurrent?.();showStill(index);}
 function navigate({from,to,onProgress,onComplete}){
  cancelCurrent?.();
  let cancelled=false,playbackReady=false,frame=0,raf=0,watchdog=0,current=from,attempt=0,playId=0,legId=0,lastTime=-1;
  const direction=Math.sign(to-from);
  const portrait=portraitViewport();
  playing=true;
  function clearFrames(){
   if(frame)video.cancelVideoFrameCallback?.(frame);
   cancelAnimationFrame(raf);clearTimeout(watchdog);frame=raf=watchdog=0;
  }
  function pause(){++playId;video.pause();}
  function cancel(){
   if(cancelled)return;
   cancelled=true;playbackReady=false;clearFrames();cancelPoster();video.onended=video.onerror=video.onwaiting=video.onplaying=null;pause();
   playing=false;if(cancelCurrent===cancel)cancelCurrent=null;
  }
  cancelCurrent=cancel;
  function fallback(){
   if(cancelled)return;
   playbackReady=false;++legId;clearFrames();pause();video.onended=video.onerror=video.onwaiting=video.onplaying=null;
   showStill(to,()=>{if(cancelled)return;cancel();onProgress(to);onComplete();});
  }
  function guardDownload(){
   clearTimeout(watchdog);
   if(!hidden)watchdog=setTimeout(fallback,12000);
  }
  function report(seconds){
   if(cancelled||seconds===lastTime)return;
   lastTime=seconds;
   guardDownload();video.hidden=false;
   const leg=Math.min(current,current+direction);
   const fraction=transitionProgress(Math.min(transitionDuration,Math.max(0,seconds*1000)),leg);
   onProgress(current+direction*fraction);
  }
  function followFrames(){
   const id=legId;
   if(video.requestVideoFrameCallback){
    frame=video.requestVideoFrameCallback((_,metadata)=>{if(cancelled||id!==legId)return;frame=0;report(metadata.mediaTime);followFrames();});
   }else{
    const tick=()=>{if(cancelled||id!==legId)return;if(video.readyState>=2&&!video.paused)report(video.currentTime);raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
   }
  }
  function play(){
   // Returning to a visible tab must not replay the previous clip while the
   // source or destination poster is still being decoded.
   if(hidden||cancelled||!playbackReady)return;
   guardDownload();
   const id=++playId,leg=legId,promise=video.play();
   promise?.catch(error=>{
    if(cancelled||hidden||id!==playId)return;
    if(error?.name==='NotSupportedError')retry(leg);else fallback();
   });
  }
  function retry(id){
   if(cancelled||id!==legId)return;
   if(attempt++===0)startLeg();else fallback();
  }
  function startLeg(){
   if(cancelled)return;
   playbackReady=false;++legId;lastTime=-1;clearFrames();pause();
   const id=legId;
   const leg=Math.min(current,current+direction),format=attempt===0?preferred:preferred==='mp4'?'webm':'mp4';
   showStill(current,decoded=>{
    if(cancelled||id!==legId)return;
    if(!decoded){fallback();return;}
    // A codec retry restarts at the source poster, so text must restart there too.
    if(attempt>0)onProgress(current);
    video.onwaiting=guardDownload;video.onplaying=guardDownload;
    video.onerror=()=>retry(id);
    video.onended=()=>{
     if(cancelled||id!==legId)return;
     playbackReady=false;++legId;clearFrames();pause();current+=direction;
     showStill(current,()=>{
      if(cancelled)return;
      onProgress(current);
      if(current===to){cancel();onComplete();}
      else{attempt=0;startLeg();}
     });
    };
    if(typeof Image==='function'){
     const nextPoster=new Image();nextPoster.fetchPriority='low';nextPoster.src=stationImage(current+direction,portrait);
    }
    video.src=transitionVideo(leg,direction,format,portrait);video.load();playbackReady=true;followFrames();play();
   });
  }
  // Keep the current frame when leaving the tab; resume the same media clock.
  cancel.setHidden=value=>{hidden=value;if(value){pause();clearTimeout(watchdog);}else play();};
  if(direction)startLeg();else showStill(to,()=>{if(cancelled)return;cancel();onProgress(to);onComplete();});
  return cancel;
 }
 function setHidden(value){hidden=value;cancelCurrent?.setHidden(value);}
 function freeze(){cancelCurrent?.();cancelPoster();video.pause();}
 return {navigate,showStation,setHidden,freeze,get playing(){return playing;},destroy:freeze};
}
