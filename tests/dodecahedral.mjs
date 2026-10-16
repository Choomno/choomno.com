// Independent floating-point checks of the two-cell renderer and viewing path.
// Algebraic/topological certification lives in dodecahedral_exact.py.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {identity,advance,multiply,beamData,packScene} from '../polyhedral.js';
import {translation,rotation} from '../intrinsic.js';
import {readingPose,readingPhase,readingRadii} from '../camera-path.js';
const data=JSON.parse(await readFile(new URL('../dodecahedral-data.json',import.meta.url),'utf8'));
const dot=(a,b)=>a.reduce((s,x,i)=>s+(i===0?-1:1)*x*b[i],0);
const scale=(a,c)=>a.map(x=>x*c),add=(a,b)=>a.map((x,i)=>x+b[i]);
const apply=(m,a)=>m.map(r=>r.reduce((s,x,i)=>s+x*a[i],0));
const close=(a,b,tol=2e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const point=(p,d,s)=>add(scale(p,Math.cosh(s)),scale(d,Math.sinh(s)));
const beams=data.cells.map(beamData);
assert.equal(data.cells.length,2);
for(let cell=0;cell<2;cell++){
 const domain=data.cells[cell];
 assert.equal(domain.vertices.length,20);assert.equal(domain.faces.length,12);assert.equal(beams[cell].length,30);
 for(const v of domain.vertices)close(dot(v,v),0);
 for(const {a,t} of beams[cell]){close(dot(a,a),-1);close(dot(t,t),1);close(dot(a,t),0);}
 for(let f=0;f<12;f++){
  const target=data.cells[domain.neighbors[f]],other=domain.otherFaces[f],m=domain.transforms[f];
  const cols=m[0].map((_,i)=>m.map(r=>r[i]));
  for(let k=0;k<4;k++)for(let l=0;l<4;l++)close(dot(cols[k],cols[l]),k===l?(k===0?-1:1):0);
  apply(m,domain.planes[f]).forEach((x,k)=>close(x,-target.planes[other][k]));
  for(let i=0;i<5;i++){
   const image=apply(m,domain.vertices[domain.faces[f][i]]),v=target.vertices[domain.vertexImages[f][i]];
   image.forEach((x,k)=>close(x/image[0],v[k]/v[0]));
  }
 }
}
const packed=packScene(data);assert.equal(packed.width,8);assert.equal(packed.height,60);
for(let cell=0;cell<2;cell++)for(let face=0;face<12;face++){
 const offset=(cell*30+face)*8*4;
 close(packed.texels[offset+28],data.cells[cell].otherFaces[face]);
 close(packed.texels[offset+29],data.cells[cell].neighbors[face]);
}
let frame=identity(),cell=0,crossings=0,cellChanges=0;
for(let i=0;i<7000;i++){
 const step=multiply(rotation(1,3,.009*Math.sin(i*.013)),translation(.031));
 const raw=multiply(frame,step),p0=raw.map(row=>row[0]);
 crossings+=+data.cells[cell].planes.some(n=>dot(p0,n)>1e-8);
 const folded=advance(frame,cell,step,data);cellChanges+=+(folded.cell!==cell);
 ({frame,cell}=folded);
 const p=frame.map(row=>row[0]);assert.ok(p.every(Number.isFinite)&&p[0]>0);
 for(const n of data.cells[cell].planes)assert.ok(dot(p,n)<5e-8);
 for(let k=0;k<4;k++)for(let l=0;l<4;l++)close(dot(frame.map(r=>r[k]),frame.map(r=>r[l])),k===l?(k===0?-1:1):0,5e-8);
}
assert.ok(crossings>30&&cellChanges>10,`Insufficient traversal: ${crossings} faces/${cellChanges} cell changes`);
// Solve the tube intersection independently in exp(2s), not shader tanh(s).
function referenceTube(p,d,a,t,r){
 const pa=dot(p,a),pt=dot(p,t),da=dot(d,a),dt=dot(d,t);
 const A=pa*pa-pt*pt,B=pa*da-pt*dt,C=da*da-dt*dt;
 const aa=A+2*B+C,bb=2*(A-C)-4*Math.cosh(r)**2,cc=A-2*B+C;
 const discriminant=bb*bb-4*aa*cc;if(discriminant<0)return [];
 const ys=Math.abs(aa)<1e-12?[-cc/bb]:[(-bb-Math.sqrt(discriminant))/(2*aa),(-bb+Math.sqrt(discriminant))/(2*aa)];
 return ys.filter(y=>y>1+1e-9).map(y=>.5*Math.log(y)).sort((a,b)=>a-b);
}
let intersectionChecks=0;
for(const domainBeams of beams)for(const {a,t} of domainBeams)for(const along of [-2,-.5,.5,2]){
 let n=[0,1,0,0];n=add(add(n,scale(a,dot(n,a))),scale(t,-dot(n,t)));
 if(dot(n,n)<1e-8){n=[0,0,1,0];n=add(add(n,scale(a,dot(n,a))),scale(t,-dot(n,t)));}
 n=scale(n,1/Math.sqrt(dot(n,n)));
 const center=point(a,t,along),R=.22,r=.025;
 const p=add(scale(center,Math.cosh(R)),scale(n,Math.sinh(R)));
 const d=add(scale(center,-Math.sinh(R)),scale(n,-Math.cosh(R)));
 close(dot(p,p),-1);close(dot(d,d),1);close(dot(p,d),0);
 const hits=referenceTube(p,d,a,t,r);assert.ok(hits.length>=1);close(hits[0],R-r,2e-7);
 const x=point(p,d,hits[0]),perp=add(add(x,scale(a,dot(x,a))),scale(t,-dot(x,t)));
 close(dot(perp,perp),Math.sinh(r)**2);close(dot(x,perp),dot(perp,perp));
 const normal=add(perp,scale(x,Math.sinh(r)**2));
 close(dot(x,normal),0);close(dot(normal,normal),Math.sinh(r)**2*Math.cosh(r)**2);
 intersectionChecks++;
}
// The complete planar route must stay clear of the edge tubes while looking
// inward toward the SAME unfolded cell center, including after face folding.
const origin=[1,0,0,0];let minClearance=Infinity,minRadius=Infinity,maxRadius=0;
const first=readingPose(readingPhase(0)),last=readingPose(readingPhase(3));
for(let k=1;k<4;k++)close(first[k][0],-last[k][0]);
const euclideanDot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const normalize=v=>scale(v,1/Math.hypot(...v));
// Preserve the approved opening frame, including its screen orientation.
// These axes come from the face geometry and its upward vertex, independently
// of the route's tangent/normal basis and roll interpolation.
const phi=(1+Math.sqrt(5))/2,L=Math.sqrt(phi+2),initialRadius=2.54;
const openingAxis=[1/L,0,phi/L],openingRight=[0,1,0],openingUp=[phi/L,0,-1/L];
const expectedFirst=[[Math.cosh(initialRadius),0,0,-Math.sinh(initialRadius)],
 ...openingAxis.map((v,i)=>[Math.sinh(initialRadius)*v,openingRight[i],openingUp[i],-Math.cosh(initialRadius)*v])];
first.forEach((row,i)=>row.forEach((x,j)=>close(x,expectedFirst[i][j])));
// Recover the plane from camera positions rather than implementation constants.
const radial0=normalize(first.slice(1).map(row=>row[0]));
const second=normalize(readingPose(readingPhase(3)*.41).slice(1).map(row=>row[0]));
const tangent0=normalize(second.map((x,i)=>x-euclideanDot(second,radial0)*radial0[i]));
const orbitNormal=[radial0[1]*tangent0[2]-radial0[2]*tangent0[1],
 radial0[2]*tangent0[0]-radial0[0]*tangent0[2],radial0[0]*tangent0[1]-radial0[1]*tangent0[0]];
let previousAngle=-1e-10;
for(let i=0;i<=18000;i++){
 const phase=readingPhase(3)*i/18000,raw=readingPose(phase),eye=raw.map(r=>r[0]),forward=raw.map(r=>r[3]);
 assert.ok(eye.every(Number.isFinite)&&eye[0]>0);
 close(euclideanDot(eye.slice(1),orbitNormal),0);
 let angle=Math.atan2(euclideanDot(eye.slice(1),tangent0),euclideanDot(eye.slice(1),radial0));
 if(angle< -1e-10)angle+=2*Math.PI;
 assert.ok(angle>=previousAngle-1e-10,'The route must keep progressing around the original cell');
 previousAngle=angle;
 close(dot(raw.map(r=>r[1]),origin),0);
 close(dot(raw.map(r=>r[2]),origin),0);
 assert.ok(dot(forward,origin)>0,'Original center must remain ahead');
 const distanceToOriginalCenter=Math.acosh(-dot(eye,origin));
 minRadius=Math.min(minRadius,distanceToOriginalCenter);maxRadius=Math.max(maxRadius,distanceToOriginalCenter);
 point(eye,forward,distanceToOriginalCenter).forEach((x,k)=>close(x,origin[k]));
 for(let k=0;k<4;k++)for(let l=0;l<4;l++)close(dot(raw.map(r=>r[k]),raw.map(r=>r[l])),k===l?(k===0?-1:1):0);
 const folded=advance(identity(),0,raw,data),p=folded.frame.map(r=>r[0]);
 for(const {a,t} of beams[folded.cell]){
  const distance=Math.acosh(Math.sqrt(Math.max(1,dot(p,a)**2-dot(p,t)**2)));
  minClearance=Math.min(minClearance,distance);
 }
}
close(previousAngle,Math.PI);
assert.ok(minClearance>.06,`Camera approaches the .025-radius tubes too closely: ${minClearance}`);
assert.ok(minRadius<2&&maxRadius>=3.39,'The route must retreat inward between its deep cusp views');
// The opening direction comes from the actual face data, not hard-coded
// camera constants. Five coplanar ideal vertices project to a regular
// pentagon; its vertex 15 is upward and the lower edge is level.
function projectVertices(camera,indices){
 const cols=camera[0].map((_,i)=>camera.map(row=>row[i]));
 return indices.map(index=>{
  const v=data.cells[0].vertices[index],p=cols.slice(1).map(c=>dot(c,v));
  assert.ok(p[2]>0,'The selected face must lie in front of the camera');
  return {index,x:p[0]/p[2]/.82,y:p[1]/p[2]/.82,depth:p[2]};
 });
}
const frontFace=data.cells[0].faces[11],frontNormal=data.cells[0].planes[11].slice(1);
const normalLength=Math.hypot(...frontNormal),eyeSpatial=first.slice(1).map(r=>r[0]);
eyeSpatial.forEach((x,i)=>close(x/Math.hypot(...eyeSpatial),frontNormal[i]/normalLength));
function regularProjectedPentagon(camera,face){
 const projected=projectVertices(camera,face),radii=projected.map(p=>Math.hypot(p.x,p.y));
 const sides=projected.map((p,i)=>Math.hypot(p.x-projected[(i+1)%5].x,p.y-projected[(i+1)%5].y));
 radii.forEach(x=>close(x,radii[0]));sides.forEach(x=>close(x,sides[0]));
 projected.forEach(p=>close(p.depth,projected[0].depth));
 close(projected.reduce((sum,p)=>sum+p.x,0),0);close(projected.reduce((sum,p)=>sum+p.y,0),0);
 return projected;
}
const openingPentagon=regularProjectedPentagon(first,frontFace);
const top=openingPentagon.find(p=>p.index===15),bottom=openingPentagon.filter(p=>[9,11].includes(p.index));
assert.ok(top&&top.y>0);close(top.x,0);
assert.ok(openingPentagon.every(p=>p.y<=top.y+1e-10));
assert.equal(bottom.length,2);close(bottom[0].y,bottom[1].y);close(bottom[0].x,-bottom[1].x);
assert.ok(bottom[0].y<0);
const oppositeFace=data.cells[0].faces.find((face,f)=>
 data.cells[0].planes[f].slice(1).every((x,i)=>Math.abs(x+frontNormal[i])<1e-10));
assert.ok(oppositeFace);
const closingPentagon=regularProjectedPentagon(last,oppositeFace);
const closingTop=closingPentagon.find(p=>p.index===8);
assert.ok(closingTop&&closingTop.y>0);close(closingTop.x,0);
assert.ok(closingPentagon.every(p=>p.y<=closingTop.y+1e-10));
const closingBottom=closingPentagon.filter(p=>[2,12].includes(p.index));
assert.equal(closingBottom.length,2);close(closingBottom[0].y,closingBottom[1].y);
assert.ok(closingBottom[0].y<0);

// At the middle stills the actual ideal vertices 7 and 19 lie exactly behind
// the camera. Their null pairing measures Busemann height relative to the
// horosphere through the original cell center, not distance to a finite proxy.
const sky=(camera,v)=>{
 const energy=-dot(camera.map(row=>row[0]),v);
 return [1,2,3].map(k=>dot(camera.map(row=>row[k]),v)/energy);
};
const cuspHeights=[];
for(const [stop,index] of [[1,7],[2,19]]){
 const cusp=data.cells[0].vertices[index],pose=readingPose(readingPhase(stop)),eye=pose.map(row=>row[0]);
 normalize(eye.slice(1)).forEach((x,i)=>close(x,cusp[i+1]/cusp[0]));
 const height=-Math.log(-dot(eye,cusp));cuspHeights.push(height);
 close(height,readingRadii[stop]);assert.ok(height>=3.19,'The camera must enter the cusp deeply');
 const direction=sky(pose,cusp);direction.forEach((x,i)=>close(x,i===2?-1:0));
 const folded=advance(identity(),0,pose,data,cusp);
 sky(folded.frame,folded.ideal).forEach((x,i)=>close(x,direction[i]));
 for(const adjacent of [stop-1,stop+1]){
  const adjacentEye=readingPose(readingPhase(adjacent)).map(row=>row[0]);
  assert.ok(height> -Math.log(-dot(adjacentEye,cusp))+1,'The cusp anchor should be closer than neighboring stills');
 }
}

// Measure true hyperbolic distances between equal phase increments, without
// consulting the path's lookup table. Both local speed and accumulated
// quarter-leg distances must remain nearly uniform near the ideal endpoints.
let maxSpeedDeviation=0,maxQuarterDeviation=0;
for(let leg=0;leg<3;leg++){
 const steps=2048,distances=[];let previous=readingPose(readingPhase(leg)).map(row=>row[0]);
 for(let i=1;i<=steps;i++){
  const next=readingPose(readingPhase(leg+i/steps)).map(row=>row[0]);
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
assert.ok(maxSpeedDeviation<.04,`Arclength resampling has excessive local speed variation: ${maxSpeedDeviation}`);
assert.ok(maxQuarterDeviation<.001,`Arclength resampling drifts over a quarter-leg: ${maxQuarterDeviation}`);

// Each centered still should contain distinct ideal endpoints. This checks
// directions geometrically, not whether rasterized edges are bright enough.
const endpointCounts=[];
for(let stop=0;stop<4;stop++){
 const frame=readingPose(readingPhase(stop));
 const cols=frame[0].map((_,i)=>frame.map(row=>row[i]));
 const projected=data.cells[0].vertices.map(v=>cols.slice(1).map(c=>dot(c,v))).filter(v=>v[2]>0)
  .map(v=>[v[0]/v[2]/.82,v[1]/v[2]/.82]);
 const count=projected.filter(([x,y])=>Math.abs(x)<390/844&&Math.abs(y)<1).length;
 assert.ok(count>=10,`Only ${count} ideal endpoints in portrait still ${stop}`);endpointCounts.push(count);
}
console.log(`Dodecahedral checks passed: ${crossings} face crossings (${cellChanges} cell changes); ${intersectionChecks} independent all-ideal tube intersections; minimum sampled route clearance ${minClearance.toFixed(6)}; portrait ideal endpoints ${endpointCounts.join('/')}; exact rearward cusp heights ${cuspHeights.map(x=>x.toFixed(6)).join('/')}; local arclength speed error ${(100*maxSpeedDeviation).toFixed(2)}%; fixed original center and upright pentagonal endpoints verified.`);
