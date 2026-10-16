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
export const fragment=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D manifold;
uniform mat4 camera;
uniform int cameraTet;
uniform vec2 resolution;
uniform int maxSteps;
out vec4 pixel;
float ld(vec4 a,vec4 b){return dot(a.yzw,b.yzw)-a.x*b.x;}
vec4 datum(int index,int slot){return texelFetch(manifold,ivec2(slot,index),0);}
mat4 pairing(int i){return mat4(datum(i,0),datum(i,1),datum(i,2),datum(i,3));}
float distanceOf(float q){return .5*log((1.+q)/(1.-q));}
void main(){
 vec2 uv=(2.*gl_FragCoord.xy-resolution)/resolution.y;
 vec4 p=camera[0];
 vec4 d=camera*vec4(0.,normalize(vec3(uv*.82,1.)));
 vec3 background=vec3(.035,.055,.07);
 int tet=cameraTet,entry=-1;
 float total=0.;
 for(int step=0;step<160;step++){
  if(step>=maxSteps)break;
  float qFace=1.;int face=-1;
  for(int f=0;f<4;f++){
   if(f==entry)continue;
   vec4 n=datum(4*tet+f,4);float b=ld(d,n);
   if(b>1e-7){float q=-ld(p,n)/b;if(q>=-2e-5&&q<qFace){qFace=max(q,0.);face=f;}}
  }
  float qHit=qFace;int vertex=-1;
  for(int v=0;v<4;v++){
   vec4 h=datum(4*tet+v,5);
   float a=ld(p,h),b=ld(d,h),aa=b*b+1.,bb=2.*a*b,cc=a*a-1.;
   float disc=bb*bb-4.*aa*cc;
   if(disc<0.)continue;
   float q0=(-bb-sqrt(disc))/(2.*aa),q1=(-bb+sqrt(disc))/(2.*aa);
   float q=q0>1e-5?q0:q1;
   // Reject the extraneous root introduced by squaring the horosphere equation.
   if(q>1e-5&&q<qHit&&(a+q*b)<0.){qHit=q;vertex=v;}
  }
  if(vertex>=0){
   float c=inversesqrt(max(1.-qHit*qHit,1e-12));
   vec4 hit=c*(p+qHit*d),direction=c*(d+qHit*p);
   vec4 h=datum(4*tet+vertex,5);
   vec4 normal=hit-h;
   float facing=clamp(abs(ld(direction,normal)),0.,1.);
   int cusp=int(datum(4*tet+vertex,6).z+.5);
   vec3 color=cusp==0?vec3(.79,.32,.22):cusp==1?vec3(.22,.56,.68):vec3(.78,.65,.32);
   total+=distanceOf(qHit);
   float lighting=.23+.67*facing;
   vec3 lit=color*lighting+vec3(.14)*pow(facing,28.);
   float fog=exp(-.075*total);
   pixel=vec4(pow(mix(background,lit,fog),vec3(1./2.2)),1.);return;
  }
  if(face<0||qFace>=.999999||total>24.)break;
  float c=inversesqrt(max(1.-qFace*qFace,1e-12));
  vec4 nextP=c*(p+qFace*d),nextD=c*(d+qFace*p);
  int i=4*tet+face;mat4 m=pairing(i);vec4 info=datum(i,6);
  p=m*nextP;d=m*nextD;
  // Control accumulation of floating point error after each face crossing.
  p/=sqrt(max(-ld(p,p),1e-12));d+=ld(p,d)*p;d/=sqrt(max(ld(d,d),1e-12));
  tet=int(info.x+.5);entry=int(info.y+.5);total+=distanceOf(qFace);
 }
 pixel=vec4(pow(background,vec3(1./2.2)),1.);
}`;
