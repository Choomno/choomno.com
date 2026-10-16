// The complete Borromean quotient, with its rhombic dodecahedral cell skeleton.
export {dot,identity,apply,multiply,orthonormalize,translation,rotation} from './intrinsic.js';
import {dot,apply,multiply,orthonormalize} from './intrinsic.js';
export function advance(frame,tet,step,data,ideal){
 frame=multiply(frame,step);
 for(let iteration=0;iteration<64;iteration++){
  const p=frame.map(row=>row[0]);let face=-1,worst=1e-8;
  for(let f=0;f<12;f++){const value=dot(p,data.planes[f]);if(value>worst){worst=value;face=f;}}
  if(face<0)return {frame:orthonormalize(frame),tet:0,ideal};
  frame=multiply(data.transforms[face],frame);
  if(ideal){ideal=apply(data.transforms[face],ideal);ideal=ideal.map(x=>x/ideal[0]);}
 }
 throw Error('Camera traversal exceeded 64 faces');
}
// Circle about the finite cell center, with the camera aimed inward.
// Spatial rotation times a radial boost times a half-turn of the camera.
export function cellTurn(angle,radius=2.4){
 const c=Math.cos(angle+Math.PI/4),s=Math.sin(angle+Math.PI/4);
 const ch=Math.cosh(radius),sh=Math.sinh(radius);
 return [[ch,0,0,-sh],[sh*s,-c,0,-ch*s],[0,0,1,0],[sh*c,s,0,-ch*c]];
}
export function beamData(data){
 const classes=[...new Set(data.vertexClasses.filter((_,i)=>data.ideal[i]))].sort();
 return data.edges.map(edge=>{
  const finite=edge.find(i=>!data.ideal[i]),ideal=edge.find(i=>data.ideal[i]);
  let a=data.vertices[finite];a=a.map(x=>x/Math.sqrt(-dot(a,a)));
  let u=data.vertices[ideal];u=u.map(x=>x/-dot(a,u));
  return {a,t:u.map((x,i)=>x-a[i]),cusp:classes.indexOf(data.vertexClasses[ideal])};
 });
}
export const fragment=`#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D manifold;
uniform mat4 camera;
uniform vec2 resolution;
uniform int maxSteps;
uniform bool cuspColors;
out vec4 pixel;
const float radius=.035;
float ld(vec4 a,vec4 b){return dot(a.yzw,b.yzw)-a.x*b.x;}
vec4 datum(int index,int slot){return texelFetch(manifold,ivec2(slot,index),0);}
mat4 pairing(int i){return mat4(datum(i,0),datum(i,1),datum(i,2),datum(i,3));}
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
 int entry=-1;float total=0.;float cr=cosh(radius),cr2=cr*cr;
 for(int step=0;step<160;step++){
  if(step>=maxSteps)break;
  float qFace=1.;int face=-1;
  for(int f=0;f<12;f++){
   if(f==entry)continue;
   vec4 n=datum(f,4);float b=ld(d,n);
   if(b>1e-7){float q=-ld(p,n)/b;if(q>=-2e-5&&q<qFace){qFace=max(q,0.);face=f;}}
  }
  float qHit=qFace;int object=-1;bool cap=false;
  // Each true cell edge is a geodesic ray from a finite vertex to an ideal one.
  for(int edge=0;edge<24;edge++){
   vec4 a=datum(edge,5),t=datum(edge,6);
   float pa=ld(p,a),pt=ld(p,t),da=ld(d,a),dt=ld(d,t);
   vec2 r=roots(da*da-dt*dt+cr2,2.*(pa*da-pt*dt),pa*pa-pt*pt-cr2);
   for(int k=0;k<2;k++){
    float q=r[k];
    if(q>1e-5&&q<qHit&&pt+q*dt>=-1e-5){qHit=q;object=edge;cap=false;}
   }
  }
  // Balls join the three incident beams at each of the eight finite vertices.
  for(int vertex=0;vertex<8;vertex++){
   vec4 a=datum(vertex,8);float pa=ld(p,a),da=ld(d,a);
   vec2 r=roots(da*da+cr2,2.*pa*da,pa*pa-cr2);
   for(int k=0;k<2;k++){float q=r[k];if(q>1e-5&&q<qHit){qHit=q;object=vertex;cap=true;}}
  }
  if(object>=0){
   float c=inversesqrt(max(1.-qHit*qHit,1e-12));
   vec4 hit=c*(p+qHit*d),direction=c*(d+qHit*p);
   vec4 a=datum(object,cap?8:5),t=datum(object,6);
   vec4 normal=cap?cr*hit-a:cr2*hit+ld(hit,a)*a-ld(hit,t)*t;
   normal/=sqrt(max(ld(normal,normal),1e-12));
   float facing=clamp(abs(ld(direction,normal)),0.,1.);
   vec3 color=vec3(.25,.245,.232);
   if(cuspColors&&!cap){
    int cusp=int(datum(object,7).y+.5);
    vec3 tint=cusp==0?vec3(.95,.49,.32):cusp==1?vec3(.25,.79,.66):vec3(.38,.58,.98);
    // Tint tends to the ideal endpoint's cusp color, without introducing a finite boundary.
    float along=asinh(max(0.,ld(hit,t))/cr);
    color=mix(color,tint,.85*(1.-exp(-along*.7)));
   }
   total+=distanceOf(qHit);
   float rim=pow(1.-facing,3.);
   // Neutral ceramic body, a narrow warm reflection, and distance falloff.
   vec3 lit=color*(.11+.72*sqrt(facing));
   lit+=vec3(.78,.74,.67)*.03*pow(facing,70.);
   lit+=vec3(.24,.23,.21)*rim*.06;
   float visibility=1./(1.+.18*pow(sinh(min(total,12.)),2.));
   vec3 mapped=vec3(1.)-exp(-lit*1.65);
   pixel=vec4(pow(mix(background,mapped,visibility),vec3(1./2.2)),1.);return;
  }
  if(face<0||qFace>=.999999||total>24.)break;
  float c=inversesqrt(max(1.-qFace*qFace,1e-12));
  vec4 nextP=c*(p+qFace*d),nextD=c*(d+qFace*p);
  mat4 m=pairing(face);p=m*nextP;d=m*nextD;
  p/=sqrt(max(-ld(p,p),1e-12));d+=ld(p,d)*p;d/=sqrt(max(ld(d,d),1e-12));
  entry=int(datum(face,7).x+.5);total+=distanceOf(qFace);
 }
 pixel=vec4(pow(background,vec3(1./2.2)),1.);
}`;
