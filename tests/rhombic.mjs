// Independent distance-parameter checks for the complete rhombic-cell renderer.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {identity,advance,rotation,translation,multiply,beamData,cellTurn} from '../rhombic.js';
const data=JSON.parse(await readFile(new URL('../rhombic-data.json',import.meta.url),'utf8'));
const dot=(a,b)=>a.reduce((s,x,i)=>s+(i===0?-1:1)*x*b[i],0);
const scale=(a,c)=>a.map(x=>x*c),add=(a,b)=>a.map((x,i)=>x+b[i]);
const map=(m,a)=>m.map(r=>r.reduce((s,x,i)=>s+x*a[i],0));
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const point=(p,d,s)=>add(scale(p,Math.cosh(s)),scale(d,Math.sinh(s)));
const beams=beamData(data);
assert.equal(beams.length,24);assert.equal(new Set(beams.map(b=>b.cusp)).size,3);
for(const {a,t} of beams){close(dot(a,a),-1);close(dot(t,t),1);close(dot(a,t),0);}
let frame=identity(),crossings=0;
for(let i=0;i<7000;i++){
 const step=multiply(rotation(1,3,.009*Math.sin(i*.013)),translation(.031));
 const raw=multiply(frame,step),p0=raw.map(row=>row[0]);
 crossings+=+data.planes.some(n=>dot(p0,n)>1e-8);
 ({frame}=advance(frame,0,step,data));
 const p=frame.map(row=>row[0]);
 assert.ok(p.every(Number.isFinite)&&p[0]>0);
 for(const n of data.planes)assert.ok(dot(p,n)<3e-8);
 for(let k=0;k<4;k++)for(let l=0;l<4;l++)close(dot(frame.map(r=>r[k]),frame.map(r=>r[l])),k===l?(k===0?-1:1):0,3e-8);
}
assert.ok(crossings>50,`Insufficient face crossings: ${crossings}`);
// Reference tube intersection solves in y=exp(2s), rather than the shader's tanh(s).
function referenceTube(p,d,a,t,r){
 const pa=dot(p,a),pt=dot(p,t),da=dot(d,a),dt=dot(d,t);
 const A=pa*pa-pt*pt,B=pa*da-pt*dt,C=da*da-dt*dt;
 const aa=A+2*B+C,bb=2*(A-C)-4*Math.cosh(r)**2,cc=A-2*B+C;
 const disc=bb*bb-4*aa*cc;if(disc<0)return [];
 const ys=Math.abs(aa)<1e-12?[-cc/bb]:[(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)];
 return ys.filter(y=>y>1+1e-9).map(y=>.5*Math.log(y)).filter(s=>dot(point(p,d,s),t)>=-1e-8).sort((a,b)=>a-b);
}
let intersectionChecks=0;
for(const {a,t} of beams)for(const s0 of [.1,.5,1.2]){
 // Construct a transverse unit normal without assumptions about edge coordinates.
 let n=[0,1,0,0];n=add(add(n,scale(a,dot(n,a))),scale(t,-dot(n,t)));
 if(dot(n,n)<1e-8){n=[0,0,1,0];n=add(add(n,scale(a,dot(n,a))),scale(t,-dot(n,t)));}
 n=scale(n,1/Math.sqrt(dot(n,n)));
 const center=point(a,t,s0),R=.22,r=.035;
 const p=add(scale(center,Math.cosh(R)),scale(n,Math.sinh(R)));
 const d=add(scale(center,-Math.sinh(R)),scale(n,-Math.cosh(R)));
 close(dot(p,p),-1);close(dot(d,d),1);close(dot(p,d),0);
 const hits=referenceTube(p,d,a,t,r);assert.ok(hits.length>=1);close(hits[0],R-r,1e-7);
 const x=point(p,d,hits[0]),perp=add(add(x,scale(a,dot(x,a))),scale(t,-dot(x,t)));
 close(dot(perp,perp),Math.sinh(r)**2,1e-8);close(dot(x,perp),dot(perp,perp));
 const normal=add(perp,scale(x,Math.sinh(r)**2));
 close(dot(x,normal),0);close(dot(normal,normal),Math.sinh(r)**2*Math.cosh(r)**2);
 assert.ok(dot(x,t)>0);assert.ok(Math.tanh(hits[0])>0&&Math.tanh(hits[0])<1);
 intersectionChecks++;
 // Ray aimed away from the endpoint behind the finite vertex must be rejected.
 const behind=point(a,t,-s0),bp=add(scale(behind,Math.cosh(R)),scale(n,Math.sinh(R)));
 const bd=add(scale(behind,-Math.sinh(R)),scale(n,-Math.cosh(R)));
 assert.equal(referenceTube(bp,bd,a,t,r).length,0);
}
console.log(`Rhombic checks passed: ${crossings} camera crossings; ${intersectionChecks} independent tube intersections; negative ray extensions excluded.`);

// Circular camera orbit about the finite cell center, always aimed inward.
const origin=[1,0,0,0],rho=2.4;
for(let i=0;i<=720;i++){
 const f=cellTurn(i*Math.PI/360,rho),p=f.map(r=>r[0]),forward=f.map(r=>r[3]);
 close(-dot(p,origin),Math.cosh(rho),1e-12);
 close(p[1]*p[1]+p[3]*p[3],Math.sinh(rho)**2,1e-12);
 close(p[2],0,1e-12);
 const centerOnRay=point(p,forward,rho);
 centerOnRay.forEach((v,j)=>close(v,origin[j],1e-12));
 for(let j=0;j<4;j++)for(let k=0;k<4;k++)close(dot(f.map(r=>r[j]),f.map(r=>r[k])),j===k?(j===0?-1:1):0,1e-12);
 close(f[2][2],1,1e-12);
 const folded=advance(identity(),0,f,data);
 for(const n of data.planes)assert.ok(dot(folded.frame.map(r=>r[0]),n)<1e-8);
}
const start=cellTurn(0),end=cellTurn(2*Math.PI);
start.flat().forEach((v,i)=>close(v,end.flat()[i],1e-12));
assert.ok(Math.hypot(...start.map((r,i)=>r[0]-cellTurn(Math.PI)[i][0]))>1);
console.log('Cell-center orbit passed: constant hyperbolic radius, moving eye, inward look direction, closed circle, no roll.');
