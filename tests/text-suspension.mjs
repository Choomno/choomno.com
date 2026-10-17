import assert from 'node:assert/strict';
import {createTextSuspension} from '../text-suspension.js';

let nextId=0,frames=new Map();
globalThis.requestAnimationFrame=callback=>{frames.set(++nextId,callback);return nextId;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
function step(now){const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(now);}
function fixture(options){const values=[],motion=createTextSuspension(value=>values.push(value),options);return {values,motion,get value(){return values.at(-1);}};}
const close=(actual,expected,tolerance=1e-12)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);

// The closed-form solution agrees across irregular display refresh intervals.
function response(times){
 const f=fixture();f.motion.set(1);for(const time of times)step(time);
 const value=f.value;f.motion.destroy();assert.equal(frames.size,0);return value;
}
const regular=response([0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200]);
const irregular=response([0,3,29,30,77,119,121,177,200]);
const analytic=1-(1+55*.2)*Math.exp(-55*.2);
close(regular,analytic);close(irregular,analytic);

// A constant destination is approached monotonically, from either direction,
// and the loop releases every animation frame once its tolerances are met.
for(const [start,target] of [[0,1],[1,0],[-3,4]]){
 const f=fixture();f.motion.set(start,{immediate:true});f.motion.set(target);
 for(let time=0;time<=1500&&frames.size;time+=7)step(time);
 assert.equal(f.value,target);assert.equal(frames.size,0);
 for(let i=1;i<f.values.length;i++){
  assert.ok(Math.sign(target-start)*(f.values[i]-f.values[i-1])>=-1e-13);
  assert.ok(f.values[i]>=Math.min(start,target)&&f.values[i]<=Math.max(start,target));
 }
 const count=f.values.length;f.motion.set(target);assert.equal(frames.size,0);assert.equal(f.values.length,count,'resting updates do not render or start another loop');f.motion.destroy();
}

// A fluctuating media target is smoothed rather than copied in visible jumps.
{
 const f=fixture();f.motion.set(0,{immediate:true});
 const targets=[.1,.19,.17,.3,.29,.42,.4,.55];let now=0,largestInput=0,largestOutput=0,previousTarget=0;
 for(const target of targets){
  largestInput=Math.max(largestInput,Math.abs(target-previousTarget));previousTarget=target;
  f.motion.set(target);const before=f.value;
  step(now);now+=8;step(now);largestOutput=Math.max(largestOutput,Math.abs(f.value-before));now+=8;
  assert.ok(f.value>=0&&f.value<=Math.max(...targets));
 }
 assert.ok(largestOutput<largestInput,'display updates distribute the irregular target jumps over time');
 f.motion.set(.55);for(;now<2000&&frames.size;now+=13)step(now);
 assert.equal(f.value,.55);assert.equal(frames.size,0);f.motion.destroy();
}

// Immediate settlement, cancellation, stale callbacks and callback reentrancy
// must not revive an obsolete spring or retain an idle requestAnimationFrame.
{
 const f=fixture();f.motion.set(1);const stale=[...frames.values()][0];step(0);step(10);
 f.motion.set(2,{immediate:true});assert.equal(f.value,2);assert.equal(frames.size,0);stale(100);assert.equal(f.value,2);assert.equal(frames.size,0);
 f.motion.set(3);const canceled=[...frames.values()][0];f.motion.destroy();const count=f.values.length;canceled(200);f.motion.set(4);
 assert.equal(f.values.length,count);assert.equal(frames.size,0);
}
{
 let motion,renders=0;motion=createTextSuspension(()=>{if(++renders===1)motion.destroy();});motion.set(1);step(0);assert.equal(frames.size,0,'destroying within render cannot reschedule the old tick');
 let replacement,replaced=false;replacement=createTextSuspension(()=>{if(!replaced){replaced=true;replacement.set(7,{immediate:true});}});
 replacement.set(2);step(0);assert.equal(frames.size,0,'an immediate update within render invalidates the original tick');replacement.destroy();
}
assert.throws(()=>createTextSuspension(()=>{},{frequency:0}),RangeError);
assert.throws(()=>createTextSuspension(()=>{},{frequency:Infinity}),RangeError);
{
 const f=fixture();assert.throws(()=>f.motion.set(NaN),RangeError);assert.equal(frames.size,0);f.motion.destroy();
}
console.log('Text suspension: exact irregular-cadence integration, critical damping, monotonic settlement, jitter smoothing, immediate updates, cancellation/reentrancy and no RAF at rest passed.');
