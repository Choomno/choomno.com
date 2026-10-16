// Independent floating-point checks of the two-cell renderer and viewing path.
// Algebraic/topological certification lives in dodecahedral_exact.py.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {identity,advance,multiply,beamData,packScene} from '../polyhedral.js';
import {translation,rotation} from '../intrinsic.js';
import {readingPose,readingPhase} from '../camera-path.js';
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
// Reading stills are fixed geometric anchors; the route may sidestep them
// to pass around the stationary text rectangles.
const origin=[1,0,0,0],euclideanDot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const normalize=v=>scale(v,1/Math.hypot(...v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const phi=(1+Math.sqrt(5))/2,L=Math.sqrt(phi+2),initialRadius=2.54;
const openingAxis=[1/L,0,phi/L],openingRight=[0,1,0],openingUp=[phi/L,0,-1/L];
function radialFrame(axis,right,up,radius){
 const ch=Math.cosh(radius),sh=Math.sinh(radius);
 return [[ch,0,0,-sh],...axis.map((v,i)=>[sh*v,right[i],up[i],-ch*v])];
}
const first=readingPose(readingPhase(0)),last=readingPose(readingPhase(3));
const expectedFirst=radialFrame(openingAxis,openingRight,openingUp,initialRadius);
first.forEach((row,i)=>row.forEach((x,j)=>close(x,expectedFirst[i][j])));
const cusp7=normalize([1,1,1]),routeNormal=[phi/2,-1/(2*phi),-.5];
const secondAngular=cross(cusp7,routeNormal),roll=Math.PI/6;
const secondRight=secondAngular.map((x,i)=>Math.cos(roll)*x-Math.sin(roll)*routeNormal[i]);
const secondUp=secondAngular.map((x,i)=>Math.sin(roll)*x+Math.cos(roll)*routeNormal[i]);
const expectedSecond=radialFrame(cusp7,secondRight,secondUp,3.4);
readingPose(readingPhase(1)).forEach((row,i)=>row.forEach((x,j)=>close(x,expectedSecond[i][j])));
// The third view is an edge-centered twofold saddle, not another cusp star.
const edgeAxis=[.5,phi/2,1/(2*phi)],thirdUp=routeNormal,thirdRight=cross(edgeAxis,thirdUp);
const expectedThird=radialFrame(edgeAxis,thirdRight,thirdUp,1.35);
const third=readingPose(readingPhase(2));
third.forEach((row,i)=>row.forEach((x,j)=>close(x,expectedThird[i][j])));
const edge=data.cells[0].edges.find(([a,b])=>a===7&&b===19);assert.ok(edge);
const normalizedMidpoint=normalize(add(data.cells[0].vertices[7].slice(1),data.cells[0].vertices[19].slice(1)));
normalizedMidpoint.forEach((x,i)=>close(x,edgeAxis[i]));
const edgeCenterDistance=Math.acosh(Math.sqrt(2/(1-euclideanDot(data.cells[0].vertices[7].slice(1),data.cells[0].vertices[19].slice(1)))));
close(edgeCenterDistance-1.35,.3401974829101885);
assert.ok(data.cells[0].vertices.every(v=>Math.hypot(...v.slice(1).map((x,i)=>x-edgeAxis[i]))>.3));
for(let k=1;k<4;k++)close(first[k][0],-last[k][0]);

// Every sampled camera frame is Lorentz orthonormal and clear of all nearby
// quotient edge tubes after folding into its actual cell.
let minClearance=Infinity,minRadius=Infinity,maxRadius=0;
for(let i=0;i<=24000;i++){
 const raw=readingPose(readingPhase(3)*i/24000),eye=raw.map(r=>r[0]);
 assert.ok(eye.every(Number.isFinite)&&eye[0]>0);
 const radius=Math.acosh(Math.max(1,-dot(eye,origin)));
 minRadius=Math.min(minRadius,radius);maxRadius=Math.max(maxRadius,radius);
 for(let k=0;k<4;k++)for(let l=0;l<4;l++)close(dot(raw.map(r=>r[k]),raw.map(r=>r[l])),k===l?(k===0?-1:1):0,1e-7);
 const folded=advance(identity(),0,raw,data),p=folded.frame.map(r=>r[0]);
 for(const {n1,n2} of beams[folded.cell]){
  const distance=Math.asinh(Math.hypot(dot(p,n1),dot(p,n2)));
  minClearance=Math.min(minClearance,distance);
 }
}
assert.ok(minClearance>.04,`Camera approaches the .025-radius tubes too closely: ${minClearance}`);
assert.ok(minRadius<1.5&&maxRadius>=3.39,'The route must retain the deep cusp anchor and the interior edge view');

function projectVertices(camera,indices){
 const cols=camera[0].map((_,i)=>camera.map(row=>row[i]));
 return indices.map(index=>{
  const v=data.cells[0].vertices[index],p=cols.slice(1).map(c=>dot(c,v));
  assert.ok(p[2]>0,'The selected face must lie in front of the camera');
  return {index,x:p[0]/p[2]/.82,y:p[1]/p[2]/.82,depth:p[2]};
 });
}
function regularProjectedPentagon(camera,face){
 const projected=projectVertices(camera,face),radii=projected.map(p=>Math.hypot(p.x,p.y));
 const sides=projected.map((p,i)=>Math.hypot(p.x-projected[(i+1)%5].x,p.y-projected[(i+1)%5].y));
 radii.forEach(x=>close(x,radii[0]));sides.forEach(x=>close(x,sides[0]));
 projected.forEach(p=>close(p.depth,projected[0].depth));
 close(projected.reduce((sum,p)=>sum+p.x,0),0);close(projected.reduce((sum,p)=>sum+p.y,0),0);
 return projected;
}
const frontFace=data.cells[0].faces[11],frontNormal=data.cells[0].planes[11].slice(1);
const openingPentagon=regularProjectedPentagon(first,frontFace);
const top=openingPentagon.find(p=>p.index===15),bottom=openingPentagon.filter(p=>[9,11].includes(p.index));
assert.ok(top&&top.y>0);close(top.x,0);
assert.ok(openingPentagon.every(p=>p.y<=top.y+1e-10));
assert.equal(bottom.length,2);close(bottom[0].y,bottom[1].y);close(bottom[0].x,-bottom[1].x);assert.ok(bottom[0].y<0);
const oppositeFace=data.cells[0].faces.find((face,f)=>
 data.cells[0].planes[f].slice(1).every((x,i)=>Math.abs(x+frontNormal[i])<1e-10));
assert.ok(oppositeFace);
const closingPentagon=regularProjectedPentagon(last,oppositeFace);
const lowest=closingPentagon.reduce((a,b)=>a.y<b.y?a:b),highest=closingPentagon.filter(p=>p.y>0);
close(lowest.x,0);assert.ok(lowest.y<0,'Final pentagon must point downward');
assert.equal(highest.length,2);close(highest[0].y,highest[1].y);close(highest[0].x,-highest[1].x);

// The second still keeps actual ideal vertex7 exactly behind the camera.
// Its null pairing is a Busemann height, not distance to a finite proxy.
const sky=(camera,v)=>{
 const energy=-dot(camera.map(row=>row[0]),v);
 return [1,2,3].map(k=>dot(camera.map(row=>row[k]),v)/energy);
};
const cusp=data.cells[0].vertices[7],second=readingPose(readingPhase(1)),secondEye=second.map(row=>row[0]);
const cuspHeight=-Math.log(-dot(secondEye,cusp));close(cuspHeight,3.4);
const direction=sky(second,cusp);direction.forEach((x,i)=>close(x,i===2?-1:0));
const foldedCusp=advance(identity(),0,second,data,cusp);
sky(foldedCusp.frame,foldedCusp.ideal).forEach((x,i)=>close(x,direction[i]));
for(const adjacent of [0,2]){
 const eye=readingPose(readingPhase(adjacent)).map(row=>row[0]);
 assert.ok(cuspHeight>-Math.log(-dot(eye,cusp))+1,'The cusp anchor should be closer than neighboring stills');
}

const endpointCounts=[];
for(let stop=0;stop<4;stop++){
 const frame=readingPose(readingPhase(stop)),cols=frame[0].map((_,i)=>frame.map(row=>row[i]));
 const projected=data.cells[0].vertices.map(v=>cols.slice(1).map(c=>dot(c,v))).filter(v=>v[2]>0)
  .map(v=>[v[0]/v[2]/.82,v[1]/v[2]/.82]);
 const count=projected.filter(([x,y])=>Math.abs(x)<390/844&&Math.abs(y)<1).length;
 assert.ok(count>=8,`Only ${count} ideal endpoints in portrait still${stop}`);endpointCounts.push(count);
}
console.log(`Dodecahedral checks passed: ${crossings} face crossings (${cellChanges} cell changes); ${intersectionChecks} independent tube intersections; route clearance ${minClearance.toFixed(6)}; portrait ideal endpoints ${endpointCounts.join('/')}; opening/cusp stills preserved, distinct twofold third view and inverted final pentagon verified.`);
