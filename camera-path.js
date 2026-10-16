// A planar route around one fixed, unfolded dodecahedral cell.
// Shared by the ray tracer and the stationary text planes.
export const readingPhase=index=>index*Math.PI/4;
export const readingRadii=[2.54,3.4,3.2,2.54];
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const unit=v=>v.map(x=>x/Math.hypot(...v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const phi=(1+Math.sqrt(5))/2,scale=Math.sqrt(phi+2);
// Face 11 is perpendicular to the opening view; its vertex 15 points up.
const axis=[1/scale,0,phi/scale];
const cusp7=unit([1,1,1]),cusp19=unit([1/phi,phi,0]);
const tangent=unit(cusp7.map((x,i)=>x-dot(cusp7,axis)*axis[i]));
const normal=cross(tangent,axis);
const directions=[axis,cusp7,cusp19,axis.map(x=>-x)];
const anchors=directions.map((v,i)=>v.map(x=>x*Math.tanh(readingRadii[i])));
// The middle views look away from ideal vertices 7 and 19. Retreat toward
// the cell center between them to pass safely inside their connecting edge.
const controls=anchors.slice(0,-1).map((v,i)=>unit(v.map((x,k)=>x+anchors[i+1][k])).map(x=>.88*x));
const rolls=[18,30,-30,18].map(degrees=>degrees*Math.PI/180);
const point=(leg,u)=>anchors[leg].map((x,i)=>(1-u)**2*x+2*u*(1-u)*controls[leg][i]+u*u*anchors[leg+1][i]);
const hyperboloid=p=>[1,...p].map(x=>x/Math.sqrt(1-dot(p,p)));
// Equal Klein-coordinate steps accelerate sharply near infinity. Sample
// hyperbolic arclength once so slide motion advances evenly along each arc.
const samples=8192;
const lengths=controls.map((_,leg)=>{
 const table=[0];let previous=hyperboloid(point(leg,0));
 for(let i=1;i<=samples;i++){
  const next=hyperboloid(point(leg,i/samples));
  const coshDistance=previous[0]*next[0]-dot(previous.slice(1),next.slice(1));
  table.push(table[i-1]+Math.acosh(Math.max(1,coshDistance)));previous=next;
 }
 return table;
});
function parameterAtLength(leg,fraction){
 if(fraction<=0)return 0;if(fraction>=1)return 1;
 const table=lengths[leg],distance=fraction*table[samples];let low=0,high=samples;
 while(high-low>1){const middle=(low+high)>>1;if(table[middle]<distance)low=middle;else high=middle;}
 return (low+(distance-table[low])/(table[high]-table[low]))/samples;
}
export function readingPose(phase){
 const progress=Math.max(0,Math.min(3,phase/readingPhase(1)));
 const leg=Math.min(2,Math.floor(progress)),fraction=progress-leg;
 const p=point(leg,parameterAtLength(leg,fraction)),radial=unit(p);
 const ch=1/Math.sqrt(1-dot(p,p)),sh=ch*Math.hypot(...p);
 const angular=cross(radial,normal),roll=rolls[leg]+(rolls[leg+1]-rolls[leg])*fraction;
 const c=Math.cos(roll),s=Math.sin(roll);
 const screenRight=angular.map((v,i)=>c*v-s*normal[i]);
 const screenUp=angular.map((v,i)=>s*v+c*normal[i]);
 return [[ch,0,0,-sh],...radial.map((v,i)=>[sh*v,screenRight[i],screenUp[i],-ch*v])];
}
