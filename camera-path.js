// Intrinsic viewing stations and a route that passes beside their text planes.
// The ray tracer and the stationary text sprites use these same frames.
export const readingPhase=index=>index*Math.PI/4;
export const readingRadii=[2.54,3.4,1.35,2.54];
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const unit=v=>v.map(x=>x/Math.hypot(...v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const phi=(1+Math.sqrt(5))/2,scale=Math.sqrt(phi+2);
const axis=[1/scale,0,phi/scale],cusp=unit([1,1,1]);
const tangent=unit(cusp.map((x,i)=>x-dot(cusp,axis)*axis[i]));
const normal=cross(tangent,axis),angular=cross(cusp,normal);
const directions=[axis,cusp,[.5,phi/2,1/(2*phi)],axis.map(x=>-x)];
const stationUps=[
 [phi/scale,0,-1/scale],
 angular.map((x,i)=>.5*x+Math.sqrt(3)/2*normal[i]),
 [phi/2,-1/(2*phi),-.5],
 tangent.map((x,i)=>-Math.sin(3*Math.PI/10)*x+Math.cos(3*Math.PI/10)*normal[i])
];
function frameAt(radial,up,radius){
 const right=cross(radial,up),ch=Math.cosh(radius),sh=Math.sinh(radius);
 return [[ch,0,0,-sh],...radial.map((v,i)=>[sh*v,right[i],up[i],-ch*v])];
}
// The first two approved stills are unchanged. The third is a twofold view
// across edge (7,19); the final regular pentagon has a downward vertex.
export const readingFrames=directions.map((v,i)=>frameAt(v,stationUps[i],readingRadii[i]));
const eyes=readingFrames.map(frame=>frame.map(row=>row[0]));
const klein=p=>p.slice(1).map(x=>x/p[0]);
const hyperboloid=p=>[1,...p].map(x=>x/Math.sqrt(1-dot(p,p)));
// Keep text tiny in curvature units while preserving its angular reading size.
// A correspondingly small sidestep clears it with very little ambient parallax.
export const textPlaneDepth=.005;
const sideDistance=2.4*textPlaneDepth,handleDistance=.25;
function sidePoint(station,distance){
 const ch=Math.cosh(distance),sh=Math.sinh(distance);
 return eyes[station].map((x,i)=>ch*x+sh*readingFrames[station][i][1]);
}
function bezier(controls,u){
 let points=controls;
 while(points.length>1)points=points.slice(0,-1).map((p,i)=>p.map((x,j)=>(1-u)*x+u*points[i+1][j]));
 return points[0];
}
// Leave each text plane laterally, then turn inward. The bridge shares the
// geodesic sidesteps' tangent lines, so arclength parameterization joins C1.
const bridges=[0,1,2].map(i=>{
 const start=klein(sidePoint(i,sideDistance)),end=klein(sidePoint(i+1,-sideDistance));
 // A shallow inward arc spreads the center-facing turn over more of the route.
 const middle=unit(start.map((x,k)=>x+end[k])).map(x=>.8*x);
 return [start,klein(sidePoint(i,sideDistance+handleDistance)),middle,
  klein(sidePoint(i+1,-sideDistance-handleDistance)),end];
});
// Near the ideal boundary, Klein-coordinate speed differs sharply from
// hyperbolic speed. The sidesteps have known arclength; only bridges need LUTs.
const samples=8192;
// Cluster samples at the tangent joins: near a cusp the bridge initially
// changes direction much faster than it does in the middle of its interval.
const parameters=Array.from({length:samples+1},(_,i)=>(1-Math.cos(Math.PI*i/samples))/2);
const bridgeLengths=bridges.map(controls=>{
 const table=[0];let previous=hyperboloid(bezier(controls,0));
 for(let i=1;i<=samples;i++){
  const next=hyperboloid(bezier(controls,parameters[i])),delta=next.map((x,k)=>x-previous[k]);
  const norm2=dot(delta.slice(1),delta.slice(1))-delta[0]*delta[0];
  table.push(table[i-1]+2*Math.asinh(Math.sqrt(Math.max(0,norm2))/2));previous=next;
 }
 return table;
});
export const routeLengths=bridgeLengths.map(table=>2*sideDistance+table[samples]);
export const routeJoinPhases=routeLengths.flatMap((length,i)=>[
 readingPhase(i+sideDistance/length),readingPhase(i+1-sideDistance/length)
]);
function bridgeParameter(leg,distance){
 const table=bridgeLengths[leg];let low=0,high=samples;
 while(high-low>1){const middle=(low+high)>>1;if(table[middle]<distance)low=middle;else high=middle;}
 return parameters[low]+(distance-table[low])/(table[high]-table[low])*(parameters[high]-parameters[low]);
}
function routePoint(leg,fraction){
 const distance=fraction*routeLengths[leg],bridgeLength=bridgeLengths[leg][samples];
 if(distance<=sideDistance)return sidePoint(leg,distance);
 if(distance>=sideDistance+bridgeLength)return sidePoint(leg+1,distance-routeLengths[leg]);
 return hyperboloid(bezier(bridges[leg],bridgeParameter(leg,distance-sideDistance)));
}
// Transport both endpoint up vectors to the current radial direction, then
// interpolate their roll. Endpoint derivatives agree with the next sidestep.
function transportedUp(start,up,radial){
 const factor=dot(up,radial)/(1+dot(start,radial));
 return unit(up.map((x,i)=>x-factor*(start[i]+radial[i])));
}
const rollChanges=[0,1,2].map(i=>{
 const up=transportedUp(directions[i],stationUps[i],directions[i+1]);
 return Math.atan2(dot(stationUps[i+1],cross(directions[i+1],up)),dot(stationUps[i+1],up));
});
export function readingPose(phase){
 const progress=Math.max(0,Math.min(3,phase/readingPhase(1)));
 if(Number.isInteger(progress))return readingFrames[progress].map(row=>row.slice());
 const leg=Math.min(2,Math.floor(progress)),fraction=progress-leg,eye=routePoint(leg,fraction);
 const radial=unit(eye.slice(1)),up=transportedUp(directions[leg],stationUps[leg],radial);
 const right=cross(radial,up),ease=fraction**3*(10+fraction*(-15+6*fraction));
 const endUp=transportedUp(directions[leg+1],stationUps[leg+1],radial);
 let difference=Math.atan2(dot(endUp,right),dot(endUp,up));
 difference+=2*Math.PI*Math.round((rollChanges[leg]-difference)/(2*Math.PI));
 const roll=difference*ease,c=Math.cos(roll),s=Math.sin(roll);
 const screenRight=right.map((x,i)=>c*x-s*up[i]),screenUp=up.map((x,i)=>c*x+s*right[i]);
 const ch=eye[0],sh=Math.hypot(...eye.slice(1));
 return [[ch,0,0,-sh],...radial.map((v,i)=>[eye[i+1],screenRight[i],screenUp[i],-ch*v])];
}
