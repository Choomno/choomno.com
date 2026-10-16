import assert from 'node:assert/strict';
import {projectReadingPlane, readingPhase, readingPose} from '../projection.js';
import {dot, advance, identity, apply} from '../rhombic.js';
import {readFile} from 'node:fs/promises';
const project = (m,x,y) => [(m[0]*x+m[4]*y+m[12])/(m[3]*x+m[7]*y+1),(m[1]*x+m[5]*y+m[13])/(m[3]*x+m[7]*y+1)];
const close = (actual, expected, tolerance=1e-8) => assert.ok(Math.abs(actual-expected)<tolerance, `${actual} != ${expected}`);
for (const [vw,vh,width,height] of [[1440,900,440,280],[625,780,440,300],[390,844,343.2,345],[320,568,281.6,390]]) {
 for(let i=0;i<4;i++) {
  const p=readingPhase(i), m=projectReadingPlane(p,p,width,height,vw,vh);
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
for (const offset of [-.12, -.04, .07, .15]) {
 const stationPhase=readingPhase(1),phase=stationPhase+offset;
 const camera=readingPose(phase),station=readingPose(stationPhase);
 const width=440,height=280,vw=1440,vh=900,z=.8;
 const half=z*.82*width/vh,vertical=half*height/width;
 const time=Math.sqrt(1+half*half+vertical*vertical+z*z);
 const x=.23*width,y=.67*height;
 const expectedRaw=apply(station,[time,-half+2*half*x/width,vertical-2*vertical*y/height,z]);
 const norm=Math.sqrt(-dot(expectedRaw,expectedRaw)),expected=expectedRaw.map(v=>v/norm);
 const [u,v]=project(projectReadingPlane(phase,stationPhase,width,height,vw,vh),x,y);
 const direction=[.82*(2*u-vw)/vh,.82*(vh-2*v)/vh,1];
 const length=Math.hypot(...direction),d=apply(camera,[0,...direction.map(v=>v/length)]);
 const eye=camera.map(row=>row[0]),normal=apply(station,[z,0,0,time]);
 const q=-dot(eye,normal)/dot(d,normal);assert.ok(q>0&&q<1);
 const actual=eye.map((v,i)=>(v+q*d[i])/Math.sqrt(1-q*q));
 actual.forEach((v,i)=>close(v,expected[i]));
}
const data=JSON.parse(await readFile(new URL('../rhombic-data.json',import.meta.url),'utf8'));
// The reversed Background pose has +z, rather than +x, precisely behind it.
const raw=readingPose(readingPhase(1)),ideal=[1,0,0,1];
const sky=(frame,u)=>{const coordinates=frame[0].map((_,j)=>dot(frame.map(r=>r[j]),u));return coordinates.slice(1).map(x=>x/-coordinates[0]);};
const folded=advance(identity(),0,raw,data,ideal);
for(const [frame,u] of [[raw,ideal],[folded.frame,folded.ideal]]) sky(frame,u).forEach((v,i)=>close(v,[0,0,-1][i]));
console.log('All four text planes match their centered reading rectangles across desktop/mobile sizes; right-to-left travel and rearward ideal endpoint verified.');
