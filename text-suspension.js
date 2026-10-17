// A critically damped attachment to the video-driven route coordinate.
// The exact solution is stable at irregular refresh intervals and has no
// oscillation. The target remains the geometric projection's single coordinate.
export function createTextSuspension(render,{frequency=55}={}){
 if(!Number.isFinite(frequency)||frequency<=0)throw new RangeError('Text suspension frequency must be positive and finite');
 let value=0,target=0,velocity=0,frame=0,last=null,generation=0,destroyed=false;
 const stop=()=>{++generation;cancelAnimationFrame(frame);frame=0;last=null;};
 const schedule=()=>{const id=generation;frame=requestAnimationFrame(now=>tick(now,id));};
 function tick(now,id){
  if(destroyed||id!==generation)return;
  frame=0;
  const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
  const displacement=value-target,term=velocity+frequency*displacement;
  const decay=Math.exp(-frequency*dt);
  let next=target+(displacement+term*dt)*decay;
  velocity=(velocity-frequency*term*dt)*decay;
  // A stationary target must not be crossed, including at a reading stop.
  if((target-value)*(target-next)<0){next=target;velocity=0;}
  value=next;
  if(Math.abs(value-target)<1e-9&&Math.abs(velocity)<1e-8){value=target;velocity=0;last=null;render(value);return;}
  render(value);if(!destroyed&&id===generation&&!frame)schedule();
 }
 return {
  set(next,{immediate=false}={}){
   if(destroyed)return;
   if(!Number.isFinite(next))throw new RangeError('Text suspension target must be finite');
   target=next;
   if(immediate){stop();value=target;velocity=0;render(value);return;}
   if(value===target&&velocity===0){if(frame)stop();return;}
   if(!frame){last=null;schedule();}
  },
  destroy(){destroyed=true;stop();}
 };
}
