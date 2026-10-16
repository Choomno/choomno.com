import assert from 'node:assert/strict';
import {phaseAtScroll} from '../scroll-choreography.js';
import * as path from '../camera-path.js';
const {readingPose,readingPhase}=path;
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+(i===0?-1:1)*x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,c)=>a.map(x=>x*c);
const eyeAt=phase=>readingPose(phase).map(row=>row[0]);
const marks=[{y:600,phase:Math.PI/4},{y:1300,phase:Math.PI/2},{y:2000,phase:3*Math.PI/4}];
for(const m of marks)assert.equal(phaseAtScroll(m.y,marks),m.phase);
for(const m of marks.slice(0,-1)){
 assert.ok(phaseAtScroll(m.y-50,marks)<m.phase);assert.ok(phaseAtScroll(m.y+50,marks)>m.phase);
 const left=(m.phase-phaseAtScroll(m.y-.01,marks))/.01,right=(phaseAtScroll(m.y+.01,marks)-m.phase)/.01;
 assert.ok(left>0&&Math.abs(left-right)<1e-7);
}
let previous=0;
for(let y=0;y<=2400;y++){const p=phaseAtScroll(y,marks);assert.ok(p>=previous);previous=p;}
// The camera initially moves toward screen-right when departing and arriving
// at every still. Stationary text therefore exits left and enters from right.
for(let stop=0;stop<4;stop++){
 const phase=readingPhase(stop),frame=readingPose(phase),eye=frame.map(row=>row[0]),right=frame.map(row=>row[1]);
 if(stop<3)assert.ok(dot(sub(eyeAt(phase+1e-5),eye),right)>0,`Station ${stop} must depart toward screen-right`);
 if(stop>0)assert.ok(dot(sub(eye,eyeAt(phase-1e-5)),right)>0,`Station ${stop} must arrive toward screen-right`);
}
// Check uniform true hyperbolic arclength independently of the implementation's
// lookup tables. Each slide transition can have a different total length.
let maxSpeedDeviation=0,maxQuarterDeviation=0;
for(let leg=0;leg<3;leg++){
 const steps=16384,distances=[];let previous=eyeAt(readingPhase(leg));
 for(let i=1;i<=steps;i++){
  const next=eyeAt(readingPhase(leg+i/steps));
  distances.push(Math.acosh(Math.max(1,-dot(previous,next))));previous=next;
 }
 const total=distances.reduce((sum,x)=>sum+x,0),mean=total/steps;
 assert.ok(total>1&&distances.every(d=>Number.isFinite(d)&&d>0));
 maxSpeedDeviation=Math.max(maxSpeedDeviation,...distances.map(d=>Math.abs(d/mean-1)));
 for(let quarter=0;quarter<4;quarter++){
  const length=distances.slice(quarter*steps/4,(quarter+1)*steps/4).reduce((sum,x)=>sum+x,0);
  maxQuarterDeviation=Math.max(maxQuarterDeviation,Math.abs(4*length/total-1));
 }
}
assert.ok(maxSpeedDeviation<.04,`Arclength resampling local speed variation ${maxSpeedDeviation}`);
assert.ok(maxQuarterDeviation<.002,`Arclength resampling quarter-leg drift ${maxQuarterDeviation}`);

// C1 here means the arclength-parametrized geometric path: adjacent legs may
// have different lengths per phase, but their unit tangents must coincide.
// Check each internal sidestep/bridge join as well as both intervening stills.
assert.ok(Array.isArray(path.routeJoinPhases)&&path.routeJoinPhases.length>=6,'Expose internal joins for independent C1 checks');
const joins=[...path.routeJoinPhases,readingPhase(1),readingPhase(2)];
let maxJoinAngle=0,maxFrameRateJump=0;
for(const phase of joins){
 if(phase<=0||phase>=readingPhase(3))continue;
 const h=2e-7,p=eyeAt(phase),left=eyeAt(phase-h),right=eyeAt(phase+h);
 const tangent=v=>{
  const projected=v.map((x,i)=>x+dot(p,v)*p[i]);
  return scale(projected,1/Math.sqrt(dot(projected,projected)));
 };
 const a=tangent(sub(p,left)),b=tangent(sub(right,p));
 const angle=Math.acos(Math.max(-1,Math.min(1,dot(a,b))));maxJoinAngle=Math.max(maxJoinAngle,angle);
 const m=readingPose(phase),before=readingPose(phase-h),after=readingPose(phase+h);
 const distance=(a,b)=>{const d=sub(a,b);return 2*Math.asinh(Math.sqrt(Math.max(0,dot(d,d)))/2);};
 const sl=distance(p,left),sr=distance(p,right);
 for(let axis=1;axis<4;axis++){
  const dl=m.map((row,i)=>(row[axis]-before[i][axis])/sl),dr=m.map((row,i)=>(after[i][axis]-row[axis])/sr);
  // Express the derivative jump in the current orthonormal frame so the
  // comparison is coordinate independent despite large cusp coordinates.
  const jump=sub(dl,dr),components=[0,1,2,3].map(k=>dot(jump,m.map(row=>row[k])));
  maxFrameRateJump=Math.max(maxFrameRateJump,Math.hypot(...components));
 }
}
assert.ok(maxJoinAngle<.003,`Route has a tangent discontinuity ${maxJoinAngle} radians`);
assert.ok(maxFrameRateJump<.03,`Camera-frame arclength derivative jumps by ${maxFrameRateJump}`);

// Physical text-plane intersections, independent of opacity or CSS clipping.
// In the station chart each rectangle lies on Z/E=z/time. Locate every sign
// crossing along the camera route and verify the eye passes OUTSIDE its finite
// width and height, even for deliberately generous mobile reading footprints.
const footprints=[
 [1440,780,620,330], [625,780,440,360],
 [390,667,343,400], [390,844,343,400], [320,568,281.6,430],
];
const samples=18000,totalPhase=readingPhase(3),sampleEyes=Array.from({length:samples+1},(_,i)=>eyeAt(totalPhase*i/samples));
let planeCrossings=0,minimumOutsidePixels=Infinity;
for(const [vw,vh,width,height] of footprints)for(let stop=0;stop<4;stop++){
 const station=readingPose(readingPhase(stop)),cols=station[0].map((_,i)=>station.map(row=>row[i]));
 const z=path.textPlaneDepth,half=z*.82*width/vh,vertical=z*.82*height/vh,time=Math.sqrt(1+half*half+vertical*vertical+z*z);
 const coordinates=eye=>[-dot(cols[0],eye),dot(cols[1],eye),dot(cols[2],eye),dot(cols[3],eye)];
 const signed=eye=>{const [E,,,Z]=coordinates(eye);return Z*time-E*z;};
 let lastValue=signed(sampleEyes[0]);
 for(let i=1;i<=samples;i++){
  const value=signed(sampleEyes[i]);
  if(value*lastValue<0){
   let low=totalPhase*(i-1)/samples,high=totalPhase*i/samples,lowSign=lastValue;
   for(let j=0;j<45;j++){
    const middle=(low+high)/2,middleSign=signed(eyeAt(middle));
    if(lowSign*middleSign<=0)high=middle;else{low=middle;lowSign=middleSign;}
   }
   const crossing=(low+high)/2,[E,X,Y,Z]=coordinates(eyeAt(crossing));
   assert.ok(Math.abs(Z*time-E*z)<1e-8);
   const x=X*time/E,y=Y*time/E;
   const outsidePixels=Math.max((Math.abs(x)-half)*width/(2*half),(Math.abs(y)-vertical)*height/(2*vertical));
   minimumOutsidePixels=Math.min(minimumOutsidePixels,outsidePixels);planeCrossings++;
   assert.ok(outsidePixels>5,`Camera crosses text rectangle ${stop}at phase${crossing}, viewport${vw}x${vh}, outside margin${outsidePixels}px`);
  }
  lastValue=value;
 }
}
assert.ok(planeCrossings>0,'Intersection audit must exercise actual text-plane crossings');
console.log(`Scroll choreography passed: monotone navigation, right-to-left text travel, local arclength error ${(100*maxSpeedDeviation).toFixed(2)}%, C1 join angle ${maxJoinAngle.toExponential(2)}, frame-rate jump ${maxFrameRateJump.toExponential(2)}; ${planeCrossings} physical text-plane crossings stay at least ${minimumOutsidePixels.toFixed(2)}px outside the reading rectangles across five desktop/mobile sizes.`);
