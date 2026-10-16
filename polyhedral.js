// Intrinsic ray tracing through a face-paired collection of ideal polyhedra.
import {dot,apply,multiply,orthonormalize} from './intrinsic.js';
export {dot,identity,apply,multiply,orthonormalize} from './intrinsic.js';

export function advance(frame,cell,step,data,ideal){
 frame=multiply(frame,step);
 for(let iteration=0;iteration<128;iteration++){
  const domain=data.cells[cell],p=frame.map(row=>row[0]);let face=-1,worst=1e-8;
  domain.planes.forEach((n,i)=>{const value=dot(p,n);if(value>worst){worst=value;face=i;}});
  if(face<0)return {frame:orthonormalize(frame),cell,ideal};
  const m=domain.transforms[face];
  frame=multiply(m,frame);
  if(ideal){ideal=apply(m,ideal);ideal=ideal.map(x=>x/ideal[0]);}
  cell=domain.neighbors[face];
 }
 throw Error('Camera traversal exceeded 128 faces');
}

export function beamData(domain){
 return domain.edges.map(([i,j])=>{
  const u=domain.vertices[i],v=domain.vertices[j],scale=Math.sqrt(-2*dot(u,v));
  if(!(scale>0))throw Error('Ideal edge endpoints must be distinct null vectors');
  const a=u.map((x,k)=>(x+v[k])/scale),t=u.map((x,k)=>(v[k]-x)/scale);
  // The geodesic's orthogonal complement is a positive definite two-plane.
  // Build its basis in double precision; the shader can then sum squares
  // instead of subtracting two large nearly equal longitudinal terms.
  const candidates=[1,2,3].map(axis=>{
   const e=[0,0,0,0];e[axis]=1;
   return e.map((x,k)=>x+dot(e,a)*a[k]-dot(e,t)*t[k]);
  });
  const unit=v=>v.map(x=>x/Math.sqrt(dot(v,v)));
  const longest=vectors=>vectors.reduce((best,v)=>dot(v,v)>dot(best,best)?v:best);
  const n1=unit(longest(candidates));
  const n2=unit(longest(candidates.map(v=>v.map((x,k)=>x-dot(v,n1)*n1[k]))));
  return {a,t,n1,n2};
 });
}

export function packScene(data){
 const faces=data.cells[0].planes.length,edges=data.cells[0].edges.length,stride=Math.max(faces,edges);
 const texels=new Float32Array(data.cells.length*stride*8*4);
 data.cells.forEach((domain,cell)=>{
  if(domain.planes.length!==faces||domain.edges.length!==edges)throw Error('Renderer requires uniform polyhedral cell types');
  for(let i=0;i<faces;i++){
   const offset=(cell*stride+i)*8*4;
   for(let col=0;col<4;col++)for(let row=0;row<4;row++)texels[offset+col*4+row]=domain.transforms[i][row][col];
   texels.set(domain.planes[i],offset+4*4);
   texels[offset+7*4]=domain.otherFaces[i];texels[offset+7*4+1]=domain.neighbors[i];
  }
  beamData(domain).forEach(({n1,n2},i)=>{
   const offset=(cell*stride+i)*8*4;
   texels.set(n1,offset+5*4);texels.set(n2,offset+6*4);
  });
 });
 return {texels,width:8,height:data.cells.length*stride,fragment:fragmentShader(faces,edges,stride)};
}

function fragmentShader(faces,edges,stride){return `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D manifold;
uniform mat4 camera;
uniform int cameraCell;
uniform vec2 resolution;
uniform int maxSteps;
uniform float beamRadius;
out vec4 pixel;
float ld(vec4 a,vec4 b){return dot(a.yzw,b.yzw)-a.x*b.x;}
vec4 datum(int cell,int index,int slot){return texelFetch(manifold,ivec2(slot,cell*${stride}+index),0);}
mat4 pairing(int cell,int i){return mat4(datum(cell,i,0),datum(cell,i,1),datum(cell,i,2),datum(cell,i,3));}
float distanceOf(float q){return .5*log((1.+q)/(1.-q));}
vec2 roots(float a,float b,float c){
 float discriminant=b*b-4.*a*c;
 if(discriminant<0.)return vec2(2.);
 if(abs(a)<1e-8)return vec2(abs(b)>1e-8?-c/b:2.,2.);
 float numerator=-.5*(b+(b>=0.?1.:-1.)*sqrt(discriminant));
 vec2 r=abs(numerator)>1e-12?vec2(numerator/a,c/numerator):vec2(-b/(2.*a));
 return vec2(min(r.x,r.y),max(r.x,r.y));
}
void main(){
 vec2 uv=(2.*gl_FragCoord.xy-resolution)/resolution.y;
 vec4 p=camera[0],d=camera*vec4(0.,normalize(vec3(uv*.82,1.)));
 vec3 background=vec3(.0035,.0033,.0031);
 int cell=cameraCell,entry=-1;float total=0.;float sr=sinh(beamRadius),sr2=sr*sr;
 for(int step=0;step<240;step++){
  if(step>=maxSteps)break;
  float qFace=1.;int face=-1;
  for(int f=0;f<${faces};f++){
   if(f==entry)continue;
   vec4 n=datum(cell,f,4);float b=ld(d,n);
   if(b>1e-7){float q=-ld(p,n)/b;if(q>=-2e-5&&q<qFace){qFace=max(q,0.);face=f;}}
  }
  float qHit=qFace;int object=-1;
  // An ideal-to-ideal edge is a complete geodesic, with no finite caps.
  for(int edge=0;edge<${edges};edge++){
   vec4 n1=datum(cell,edge,5),n2=datum(cell,edge,6);
   vec2 P=vec2(ld(p,n1),ld(p,n2)),D=vec2(ld(d,n1),ld(d,n2));
   vec2 r=roots(dot(D,D)+sr2,2.*dot(P,D),dot(P,P)-sr2);
   for(int k=0;k<2;k++){
    float q=r[k];if(q>1e-5&&q<qHit){qHit=q;object=edge;}
   }
  }
  if(object>=0){
   float c=inversesqrt(max(1.-qHit*qHit,1e-12));
   vec4 hit=c*(p+qHit*d),direction=c*(d+qHit*p);
   vec4 n1=datum(cell,object,5),n2=datum(cell,object,6);
   vec4 normal=ld(hit,n1)*n1+ld(hit,n2)*n2+sr2*hit;
   normal/=sqrt(max(ld(normal,normal),1e-12));
   float facing=clamp(abs(ld(direction,normal)),0.,1.);
   vec3 color=vec3(.32,.3136,.297);
   total+=distanceOf(qHit);
   float rim=pow(1.-facing,3.);
   vec3 lit=color*(.11+.72*sqrt(facing));
   lit+=vec3(.78,.74,.67)*.03*pow(facing,70.);
   lit+=vec3(.24,.23,.21)*rim*.06;
   float visibility=exp(-.18*total)/(1.+.18*total*total);
   vec3 mapped=vec3(1.)-exp(-lit*1.65);
   pixel=vec4(pow(mix(background,mapped,visibility),vec3(1./2.2)),1.);return;
  }
  if(face<0||qFace>=.999999||total>32.)break;
  float c=inversesqrt(max(1.-qFace*qFace,1e-12));
  vec4 nextP=c*(p+qFace*d),nextD=c*(d+qFace*p);
  mat4 m=pairing(cell,face);vec4 meta=datum(cell,face,7);
  p=m*nextP;d=m*nextD;
  p/=sqrt(max(-ld(p,p),1e-12));d+=ld(p,d)*p;d/=sqrt(max(ld(d,d),1e-12));
  entry=int(meta.x+.5);cell=int(meta.y+.5);total+=distanceOf(qFace);
 }
 pixel=vec4(pow(background,vec3(1./2.2)),1.);
}`;}
