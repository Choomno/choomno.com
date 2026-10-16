import assert from 'node:assert/strict';
import {projectReadingPlane, projectReadingPlaneWithDepth, nearPlaneOpacity, readingPhase, readingPose} from '../projection.js';
import {dot, apply} from '../rhombic.js';
const project = (m,x,y) => [(m[0]*x+m[4]*y+m[12])/(m[3]*x+m[7]*y+1),(m[1]*x+m[5]*y+m[13])/(m[3]*x+m[7]*y+1)];
const close = (actual, expected, tolerance=1e-8) => assert.ok(Math.abs(actual-expected)<tolerance, `${actual} != ${expected}`);
for (const [vw,vh,width,height] of [[1440,900,440,280],[625,780,440,300],[390,844,343.2,345],[320,568,281.6,390]]) {
 for(let i=0;i<4;i++) {
  const p=readingPhase(i), m=projectReadingPlane(p,p,width,height,vw,vh);
  const projection=projectReadingPlaneWithDepth(p,p,width,height,vw,vh);
  assert.deepEqual(projection.matrix,m);close(projection.minimumDepth,.8);assert.equal(projection.nearOpacity,1,'reading stills retain full opacity');
  for(const [x,y] of [[0,0],[width,0],[width,height],[0,height],[width/2,height/2]]) {
   const [u,v]=project(m,x,y); close(u,(vw-width)/2+x); close(v,(vh-height)/2+y);
  }
  if(i<3){
   const next=readingPhase(i+1);
   const departing=project(projectReadingPlane(p+.01,p,width,height,vw,vh),width/2,height/2);
   const arriving=project(projectReadingPlane(next-.01,next,width,height,vw,vh),width/2,height/2);
   assert.ok(departing[0]<vw/2 && arriving[0]>vw/2,'Forward motion must carry text right to left');
  }
 }
}
// Independent incidence test: the rendered pixel's hyperbolic ray must meet
// the stationary totally geodesic text plane at the selected text coordinate.
for (const offset of [-.08, -.04, 0, .04, .07]) {
 const stationPhase=readingPhase(1),phase=stationPhase+offset;
 const camera=readingPose(phase),station=readingPose(stationPhase);
 const width=440,height=280,vw=1440,vh=900,z=.8;
 const half=z*.82*width/vh,vertical=half*height/width;
 const time=Math.sqrt(1+half*half+vertical*vertical+z*z);
 const x=.23*width,y=.67*height;
 const expectedRaw=apply(station,[time,-half+2*half*x/width,vertical-2*vertical*y/height,z]);
 const norm=Math.sqrt(-dot(expectedRaw,expectedRaw)),expected=expectedRaw.map(v=>v/norm);
 const projection=projectReadingPlaneWithDepth(phase,stationPhase,width,height,vw,vh);
 assert.ok(projection.nearOpacity>0&&projection.matrix,'incidence sample must be visibly in front of the camera');
 const [u,v]=project(projection.matrix,x,y);
 const direction=[.82*(2*u-vw)/vh,.82*(vh-2*v)/vh,1];
 const length=Math.hypot(...direction),d=apply(camera,[0,...direction.map(v=>v/length)]);
 const eye=camera.map(row=>row[0]),normal=apply(station,[z,0,0,time]);
 const q=-dot(eye,normal)/dot(d,normal);assert.ok(q>0&&q<1);
 const actual=eye.map((v,i)=>(v+q*d[i])/Math.sqrt(1-q*q));
 actual.forEach((v,i)=>close(v,expected[i]));
}
// At this later camera position the stationary plane is genuinely behind us.
// Verify this independently instead of treating a null matrix as a skipped test.
{
 const stationPhase=readingPhase(1),phase=stationPhase+.15;
 const station=readingPose(stationPhase),forward=readingPose(phase).map(row=>row[3]);
 const width=440,height=280,vw=1440,vh=900,z=.8;
 const half=z*.82*width/vh,vertical=half*height/width,time=Math.sqrt(1+half*half+vertical*vertical+z*z);
 for(const [x,y] of [[0,0],[width,0],[width,height],[0,height],[.23*width,.67*height]]){
  const worldPoint=apply(station,[time,-half+2*half*x/width,vertical-2*vertical*y/height,z]);
  assert.ok(dot(forward,worldPoint)<0,'culled points must lie behind the camera');
 }
 const culled=projectReadingPlaneWithDepth(phase,stationPhase,width,height,vw,vh);
 assert.equal(culled.matrix,null);assert.equal(culled.nearOpacity,0);
 assert.equal(projectReadingPlane(phase,stationPhase,width,height,vw,vh),null);
 // Locate the actual clip crossing, then check visibility continuously across it.
 let low=stationPhase,high=phase;
 for(let i=0;i<50;i++){
  const middle=(low+high)/2;
  if(projectReadingPlaneWithDepth(middle,stationPhase,width,height,vw,vh).minimumDepth>.02)low=middle;else high=middle;
 }
 const before=projectReadingPlaneWithDepth(low-1e-6,stationPhase,width,height,vw,vh);
 const after=projectReadingPlaneWithDepth(high+1e-6,stationPhase,width,height,vw,vh);
 assert.ok(before.matrix);assert.equal(after.matrix,null);
 assert.equal(before.nearOpacity,0);assert.equal(after.nearOpacity,0,'the hard clip occurs only after a complete fade');
}
// The fade is monotone and C2 where it joins fully hidden/fully opaque states.
assert.equal(nearPlaneOpacity(-1),0);assert.equal(nearPlaneOpacity(.2),0);
assert.equal(nearPlaneOpacity(.7),1);assert.equal(nearPlaneOpacity(.8),1);
let previous=0;
for(let i=0;i<=100;i++){const opacity=nearPlaneOpacity(.2+i*.005);assert.ok(opacity>=previous-1e-14);previous=opacity;}
const epsilon=1e-5;
for(const [boundary,direction,level] of [[.2,1,0],[.7,-1,1]]){
 const first=nearPlaneOpacity(boundary+direction*epsilon),second=nearPlaneOpacity(boundary+direction*2*epsilon);
 assert.ok(Math.abs(first-level)/epsilon<1e-6,'opacity speed vanishes at the fade boundary');
 assert.ok(Math.abs(second-2*first+level)/(epsilon*epsilon)<.01,'opacity acceleration vanishes at the fade boundary');
}
console.log('All four text planes match their centered reading rectangles across desktop/mobile sizes; right-to-left travel, ray incidence and continuous near-plane fading verified.');
