// Near a cusp, longitudinal Lorentz coordinates are large while the tube
// radius is small. Compare the shader's positive definite normal-plane
// equation with an independent exp(2s) equation and known transverse rays.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {beamData,packScene} from '../polyhedral.js';
const data=JSON.parse(await readFile(new URL('../dodecahedral-data.json',import.meta.url),'utf8'));
const dot=(a,b)=>a.reduce((s,x,i)=>s+(i===0?-1:1)*x*b[i],0);
const add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,c)=>a.map(x=>x*c);
const f=Math.fround,fadd=(a,b)=>f(f(a)+f(b)),fsub=(a,b)=>f(f(a)-f(b)),fmul=(a,b)=>f(f(a)*f(b));
const fdot=(a,b)=>fsub(fadd(fadd(fmul(a[1],b[1]),fmul(a[2],b[2])),fmul(a[3],b[3])),fmul(a[0],b[0]));
const fdot2=(a,b)=>fadd(fmul(a[0],b[0]),fmul(a[1],b[1]));
const radius=.025,sr2=Math.sinh(radius)**2;
const close=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b} by ${Math.abs(a-b)}`);
function roots(A,B,C,rounded=false){
 const op=rounded?f:x=>x,discriminant=op(op(B*B)-op(op(4*A)*C));
 if(discriminant<0)return [];
 if(Math.abs(A)<1e-8)return Math.abs(B)>1e-8?[op(-C/B)]:[];
 const numerator=op(-.5*op(B+(B>=0?1:-1)*op(Math.sqrt(discriminant))));
 return (Math.abs(numerator)>1e-12?[op(numerator/A),op(C/numerator)]:[op(-B/op(2*A))]).sort((a,b)=>a-b);
}
function stable(p,d,{n1,n2},rounded=false){
 const op=rounded?f:x=>x,ld=rounded?fdot:dot;
 const P=[ld(p,n1),ld(p,n2)],D=[ld(d,n1),ld(d,n2)],square=rounded?fdot2:(a,b)=>a[0]*b[0]+a[1]*b[1];
 const r2=op(op(Math.sinh(op(radius)))**2);
 return roots(op(square(D,D)+r2),op(2*square(P,D)),op(square(P,P)-r2),rounded).filter(q=>q>1e-5&&q<1).map(Math.atanh);
}
function longitudinal(p,d,{a,t},rounded=false){
 const op=rounded?f:x=>x,ld=rounded?fdot:dot;
 const pa=ld(p,a),pt=ld(p,t),da=ld(d,a),dt=ld(d,t),cr2=op(op(Math.cosh(op(radius)))**2);
 return roots(op(op(op(da*da)-op(dt*dt))+cr2),op(2*op(op(pa*da)-op(pt*dt))),op(op(op(pa*pa)-op(pt*pt))-cr2),rounded)
  .filter(q=>q>1e-5&&q<1).map(Math.atanh);
}
function independent(p,d,{a,t}){
 const pa=dot(p,a),pt=dot(p,t),da=dot(d,a),dt=dot(d,t);
 const A=pa*pa-pt*pt,B=pa*da-pt*dt,C=da*da-dt*dt;
 return roots(A+2*B+C,2*(A-C)-4*Math.cosh(radius)**2,A-2*B+C)
  .filter(y=>y>1+1e-9).map(y=>.5*Math.log(y));
}
const beams=beamData(data.cells[0]),packed=packScene(data);
assert.match(packed.fragment,/uniform highp sampler2D manifold;/,'Float32 scene data must not be rounded by an implicit low-precision sampler');
for(let edge=0;edge<beams.length;edge++){
 const {a,t,n1,n2}=beams[edge];
 for(const n of [n1,n2]){close(dot(n,n),1,2e-13);close(dot(n,a),0,2e-13);close(dot(n,t),0,2e-13);}
 close(dot(n1,n2),0,2e-13);
 for(let k=0;k<4;k++){
  assert.equal(packed.texels[edge*32+20+k],f(n1[k]));
  assert.equal(packed.texels[edge*32+24+k],f(n2[k]));
 }
}
let cases=0,hits=0,stableMisses=0,oldMisses=0,maxStableError=0,maxOldError=0,sumStableError=0,sumOldError=0;
for(const beam of beams)for(const along of [-4,-3.6,-3.4,3.4,3.6,4])for(let rotation=0;rotation<8;rotation++){
 const {a,t,n1,n2}=beam,theta=rotation*Math.PI/4;
 const center=add(scale(a,Math.cosh(along)),scale(t,Math.sinh(along)));
 const n=add(scale(n1,Math.cos(theta)),scale(n2,Math.sin(theta)));
 const side=add(scale(n1,-Math.sin(theta)),scale(n2,Math.cos(theta)));
 const R=.09,p=add(scale(center,Math.cosh(R)),scale(n,Math.sinh(R)));
 const inward=add(scale(center,-Math.sinh(R)),scale(n,-Math.cosh(R)));
 const tangentAngle=Math.asin(Math.sinh(radius)/Math.sinh(R));
 for(const fraction of [0,.5,.99,1.01,1.2]){
  const angle=fraction*tangentAngle,d=add(scale(inward,Math.cos(angle)),scale(side,Math.sin(angle)));
  const expected=independent(p,d,beam),actual=stable(p,d,beam);
  assert.equal(actual.length>0,fraction<1);assert.equal(expected.length>0,fraction<1);
  if(actual.length){close(actual[0],expected[0],1e-7);if(fraction===0)close(actual[0],R-radius,1e-9);}
  const gpu=stable(p,d,beam,true),old=longitudinal(p,d,beam,true);cases++;
  stableMisses+=+(!!gpu.length!==(fraction<1));oldMisses+=+(!!old.length!==(fraction<1));
  if(expected.length&&gpu.length){const error=Math.abs(gpu[0]-expected[0]);maxStableError=Math.max(maxStableError,error);sumStableError+=error;}
  if(expected.length&&old.length){const error=Math.abs(old[0]-expected[0]);maxOldError=Math.max(maxOldError,error);sumOldError+=error;}
  if(expected.length)hits++;
  if(actual.length){
   const s=actual[0],hit=add(scale(p,Math.cosh(s)),scale(d,Math.sinh(s)));
   const perp=add(scale(n1,dot(hit,n1)),scale(n2,dot(hit,n2)));
   const normal=add(perp,scale(hit,sr2));
   close(dot(perp,perp),sr2,2e-10);close(dot(normal,hit),0,2e-10);close(dot(normal,normal),sr2*(1+sr2),2e-10);
  }
 }
}
console.log({cases,hits,stableMisses,oldMisses,maxStableError,maxOldError,meanStableError:sumStableError/hits,meanOldError:sumOldError/hits});
assert.equal(stableMisses,0,'Float32 normal-plane roots must classify every near-cusp test ray correctly');
// One-percent-inside tangencies amplify input rounding. Even these rays
// remain accurate to 1.2% of the narrow tube radius at longitudinal distance4.
assert.ok(maxStableError<.012*radius,`Float32 near-cusp error ${maxStableError}`);
assert.ok(sumStableError<sumOldError/20,'Normal-plane equation should remove longitudinal cancellation');
console.log('Stable tube intersections and surface normals agree with independent geometry; float32 near-cusp rays remain accurate.');
