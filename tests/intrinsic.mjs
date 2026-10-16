// Mathematical invariants, using an independent geodesic reference in distance s.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('borromean-data.json',root),'utf8'));
const source=await readFile(new URL('intrinsic.js',root),'utf8');
const motion=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const inner=(x,y)=>x.reduce((s,a,i)=>s+(i===0?-1:1)*a*y[i],0);
const map=(m,x)=>m.map(r=>r.reduce((s,a,i)=>s+a*x[i],0));
const add=(x,y,a=1)=>x.map((v,i)=>v+a*y[i]);
const scale=(x,a)=>x.map(v=>a*v);
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const vecClose=(a,b,tol=1e-9)=>a.forEach((v,i)=>close(v,b[i],tol));
const finite=x=>assert.ok(x.every(Number.isFinite));
const h=(t,v)=>scale(data.vertices[4*t+v],data.scales[4*t+v]);
for(let i=0;i<32;i++){
 const m=data.transforms[i],j=4*data.neighbors[i]+data.otherFaces[i];
 assert.equal(data.neighbors[j],Math.floor(i/4));assert.equal(data.otherFaces[j],i%4);
 for(let k=0;k<4;k++){
  const e=Array.from({length:4},(_,v)=>+(k===v));
  vecClose(map(data.transforms[j],map(m,e)),e);
  for(let l=0;l<4;l++)close(inner(m.map(r=>r[k]),m.map(r=>r[l])),k===l?(k===0?-1:1):0);
 }
 close(inner(data.planes[i],data.planes[i]),1);
 vecClose(map(m,data.planes[i]),scale(data.planes[j],-1));
 // Every ideal vertex of the common face has the same cusp label and
 // horosphere equation from either tetrahedron: no geometric/color seam.
 for(let v=0;v<4;v++)if(v!==i%4){
  const mapped=map(m,h(Math.floor(i/4),v));
  const candidates=[0,1,2,3].filter(w=>w!==j%4);
  const w=candidates.find(w=>mapped.every((x,k)=>Math.abs(x-h(Math.floor(j/4),w)[k])<1e-9));
  assert.notEqual(w,undefined);
  assert.equal(data.cusps[4*Math.floor(i/4)+v],data.cusps[4*Math.floor(j/4)+w]);
 }
}
for(const v of data.vertices)close(inner(v,v),0);
let frame=motion.identity(),tet=0,crossings=0;
for(let i=0;i<6000;i++){
 const step=motion.multiply(motion.rotation(1,3,.007*Math.sin(i*.011)),motion.translation(.023));
 const next=motion.advance(frame,tet,step,data);crossings+=+(next.tet!==tet);({frame,tet}=next);
 const p=frame.map(row=>row[0]);finite(p);close(inner(p,p),-1,2e-8);
 assert.ok(p[0]>0);
 for(let f=0;f<4;f++)assert.ok(inner(p,data.planes[4*tet+f])<2e-8);
 for(let k=0;k<4;k++)for(let l=0;l<4;l++)close(inner(frame.map(r=>r[k]),frame.map(r=>r[l])),k===l?(k===0?-1:1):0,2e-8);
}
assert.ok(crossings>30,`Insufficient camera crossings: ${crossings}`);
// Reference intersection uses y=exp(s), independent of the shader's tanh(s)
// parameter. A cosh(s)+B sinh(s)=-1 becomes a quadratic in y.
function trace(start,direction,startTet){
 let p=start.slice(),d=direction.slice(),t=startTet,entry=-1,total=0;
 for(let count=0;count<180;count++){
  let exit=Infinity,face=-1;
  for(let f=0;f<4;f++)if(f!==entry){
   const n=data.planes[4*t+f],A=inner(p,n),B=inner(d,n);
   if(B<=1e-11)continue;
   const ratio=(B-A)/(B+A);
   if(ratio<=0)continue;
   const s=.5*Math.log(ratio);
   if(s>=-1e-9&&s<exit){exit=Math.max(s,0);face=f;}
  }
  let hit=Infinity,vertex=-1;
  for(let v=0;v<4;v++){
   const H=h(t,v),A=inner(p,H),B=inner(d,H),a=A+B,c=A-B;
   const disc=4-4*a*c;if(disc<0)continue;
   for(const y of [(-2-Math.sqrt(disc))/(2*a),(-2+Math.sqrt(disc))/(2*a)]){
    if(y<=1+1e-9)continue;const s=Math.log(y);
    if(s<hit&&s<exit){hit=s;vertex=v;}
   }
  }
  if(vertex>=0){
   const point=add(scale(p,Math.cosh(hit)),scale(d,Math.sinh(hit)));
   const normal=add(point,h(t,vertex),-1);
   finite(point);finite(normal);close(inner(point,point),-1,2e-7);
   close(inner(point,h(t,vertex)),-1,2e-7);close(inner(normal,normal),1,2e-7);
   close(inner(point,normal),0,2e-7);
   return {cusp:data.cusps[4*t+vertex],count,distance:total+hit};
  }
  if(face<0||total+exit>24)return null;
  const nextP=add(scale(p,Math.cosh(exit)),scale(d,Math.sinh(exit)));
  const nextD=add(scale(p,Math.sinh(exit)),scale(d,Math.cosh(exit)));
  const index=4*t+face,m=data.transforms[index];
  close(inner(nextP,data.planes[index]),0,1e-7);
  p=map(m,nextP);d=map(m,nextD);t=data.neighbors[index];entry=data.otherFaces[index];total+=exit;
  close(inner(p,data.planes[4*t+entry]),0,1e-7);
  finite(p);finite(d);
  // A coordinate change must preserve ray speed and its tangency.
  const roundoff=2e-8*Math.max(1,...p.map(x=>x*x),...d.map(x=>x*x));
  close(inner(p,p),-1,roundoff);close(inner(d,d),1,roundoff);close(inner(p,d),0,roundoff);
  // Recondition the reference frame by Lorentz Gram--Schmidt.
  p=scale(p,1/Math.sqrt(-inner(p,p)));d=add(d,p,inner(p,d));d=scale(d,1/Math.sqrt(inner(d,d))); 
 }
 return null;
}
let hits=0,passedFaces=0;const seen=new Set();
for(const [F,T] of [[motion.identity(),0],[frame,tet]])for(let y=-8;y<=8;y++)for(let x=-12;x<=12;x++){
 const v=[x/12,y/12,1],norm=Math.hypot(...v),p=F.map(r=>r[0]),d=map(F,[0,...v.map(x=>x/norm)]);
 const result=trace(p,d,T);if(result){hits++;passedFaces+=result.count;seen.add(result.cusp);assert.ok(result.distance>0&&Number.isFinite(result.distance));}
}
assert.ok(hits>500,`Too few cusp hits: ${hits}`);assert.ok(passedFaces>500);assert.equal(seen.size,3);
console.log(`Intrinsic invariants passed: 32 pairings; ${crossings} camera crossings; ${hits} reference cusp hits; ${passedFaces} ray face crossings; all three cusps.`);
