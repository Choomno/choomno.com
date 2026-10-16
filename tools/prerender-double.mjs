// Desktop GLSL for offline rendering. Geometry and camera use IEEE float64.
// The material is the same float32 color calculation as the WebGL renderer.
// Factoring the tube discriminant avoids subtracting quartic-sized terms.
export function doublePrecisionFragment({faces,edges,stride,texelCount}) {
 return `#version 450 core
layout(std140) uniform ManifoldData { dvec4 sceneData[${texelCount}]; };
uniform dmat4 camera;
uniform int cameraCell;
uniform dvec2 resolution;
uniform int maxSteps;
uniform double beamRadiusSquared;
out vec4 pixel;
double ld(dvec4 a,dvec4 b){return dot(a.yzw,b.yzw)-a.x*b.x;}
dvec4 datum(int cell,int index,int slot){return sceneData[(cell*${stride}+index)*8+slot];}
dmat4 pairing(int cell,int i){return dmat4(datum(cell,i,0),datum(cell,i,1),datum(cell,i,2),datum(cell,i,3));}
float distanceOf(double q){return .5*log(float((1.0LF+q)/(1.0LF-q)));}
dvec3 roots(dvec2 P,dvec2 D,double sr2){
 double a=dot(D,D)+sr2,B=dot(P,D),c=dot(P,P)-sr2;
 precise double product=P.y*D.x;
 double determinant=fma(P.x,D.y,-product)+fma(-P.y,D.x,product);
 double halfDiscriminant=fma(sr2,dot(D-P,D+P)+sr2,-determinant*determinant);
 if(halfDiscriminant<0.0LF)return dvec3(2.0LF,2.0LF,halfDiscriminant);
 double numerator=-(B+(B>=0.0LF?1.0LF:-1.0LF)*sqrt(halfDiscriminant));
 dvec2 r=abs(numerator)>1e-12LF?dvec2(numerator/a,c/numerator):dvec2(-B/a);
 return dvec3(min(r.x,r.y),max(r.x,r.y),halfDiscriminant);
}
void main(){
 dvec2 uv=(2.0LF*dvec2(gl_FragCoord.xy)-resolution)/resolution.y;
 dvec4 p=camera[0],d=camera*dvec4(0.0LF,normalize(dvec3(uv*.82LF,1.0LF)));
 vec3 background=vec3(.0035,.0033,.0031);
 int cell=cameraCell,entry=-1;float total=0.;double sr2=beamRadiusSquared;
 for(int step=0;step<160;step++){
  if(step>=maxSteps)break;
  double qFace=1.0LF;int face=-1;
  for(int f=0;f<${faces};f++){
   if(f==entry)continue;
   dvec4 n=datum(cell,f,4);double b=ld(d,n);
   if(b>1e-7LF){double q=-ld(p,n)/b;if(q>=-2e-5LF&&q<qFace){qFace=max(q,0.0LF);face=f;}}
  }
  double qHit=qFace,hitHalfDiscriminant=0.0LF;int object=-1;
  for(int edge=0;edge<${edges};edge++){
   dvec4 n1=datum(cell,edge,5),n2=datum(cell,edge,6);
   dvec2 P=dvec2(ld(p,n1),ld(p,n2)),D=dvec2(ld(d,n1),ld(d,n2));
   dvec3 r=roots(P,D,sr2);
   for(int k=0;k<2;k++){
    double q=r[k];if(q>1e-5LF&&q<qHit){qHit=q;object=edge;hitHalfDiscriminant=r.z;}
   }
  }
  if(object>=0){
   float facing=float(clamp(sqrt(max(hitHalfDiscriminant,0.0LF)/(sr2*(1.0LF+sr2))),0.0LF,1.0LF));
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
  if(face<0||qFace>=.999999LF||total>20.)break;
  double c=inversesqrt(max(1.0LF-qFace*qFace,1e-12LF));
  dvec4 nextP=c*(p+qFace*d),nextD=c*(d+qFace*p);
  dmat4 m=pairing(cell,face);dvec4 meta=datum(cell,face,7);
  p=m*nextP;d=m*nextD;
  p/=sqrt(max(-ld(p,p),1e-12LF));d+=ld(p,d)*p;d/=sqrt(max(ld(d,d),1e-12LF));
  entry=int(meta.x+.5LF);cell=int(meta.y+.5LF);total+=distanceOf(qFace);
 }
 pixel=vec4(pow(background,vec3(1./2.2)),1.);
}
`;
}
