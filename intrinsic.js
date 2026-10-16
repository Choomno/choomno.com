// Intrinsic hyperbolic ray tracing. All vectors are (time,x,y,z).
// The manifold data is generated from SnapPy's L6a4, not a reflection orbifold.
export const dot=(a,b)=>-a[0]*b[0]+a.slice(1).reduce((s,x,i)=>s+x*b[i+1],0);
export const identity=()=>Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>+(i===j)));
export const apply=(a,v)=>a.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
export const multiply=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,x,k)=>s+x*b[k][j],0)));
export function orthonormalize(m){const columns=[];for(let j=0;j<4;j++){let v=m.map(row=>row[j]);for(let k=0;k<j;k++){const q=dot(v,columns[k])*(k===0?-1:1);v=v.map((x,i)=>x-q*columns[k][i]);}const scale=Math.sqrt(Math.abs(dot(v,v)));columns.push(v.map(x=>x/scale));}return m.map((_,i)=>columns.map(v=>v[i]));}
export function advance(frame,tet,step,data){frame=multiply(frame,step);for(let i=0;i<64;i++){const p=frame.map(row=>row[0]);let face=-1,worst=1e-8;for(let f=0;f<4;f++){const d=dot(p,data.planes[4*tet+f]);if(d>worst){worst=d;face=f;}}if(face<0)return {frame:orthonormalize(frame),tet};const index=4*tet+face;frame=multiply(data.transforms[index],frame);tet=data.neighbors[index];}throw Error('Camera traversal exceeded 64 faces');}
export function translation(distance){const m=identity();m[0][0]=m[3][3]=Math.cosh(distance);m[0][3]=m[3][0]=Math.sinh(distance);return m;}
export function rotation(a,b,angle){const m=identity();m[a][a]=m[b][b]=Math.cos(angle);m[a][b]=-Math.sin(angle);m[b][a]=Math.sin(angle);return m;}
