// One circle about the center of a fixed, unfolded dodecahedral cell.
// Shared by the ray tracer and the stationary text planes.
export const readingPhase=index=>index*Math.PI/4;
export const orbitRadius=2.54;
const phi=(1+Math.sqrt(5))/2;
const scale=Math.sqrt(phi+2);
// Face 11 is perpendicular to the opening view; its vertex 15 points up.
const axis=[1/scale,0,phi/scale],up=[phi/scale,0,-1/scale],right=[0,1,0];
// This small tilt approaches a cusp while keeping the entire circle clear of edges.
const tilt=Math.PI/20,ct=Math.cos(tilt),st=Math.sin(tilt);
const orbitTangent=right.map((v,i)=>ct*v+st*up[i]);
const orbitNormal=up.map((v,i)=>ct*v-st*right[i]);
export function readingPose(phase){
 // Four equally spaced stops along a half-circle, with the cell center always ahead.
 const angle=phase*4/3;
 const c=Math.cos(angle),s=Math.sin(angle),ch=Math.cosh(orbitRadius),sh=Math.sinh(orbitRadius);
 const radial=axis.map((v,i)=>c*v+s*orbitTangent[i]);
 const tangent=axis.map((v,i)=>-s*v+c*orbitTangent[i]);
 // A constant roll restores the upright opening pentagon.
 const screenRight=tangent.map((v,i)=>ct*v-st*orbitNormal[i]);
 const screenUp=tangent.map((v,i)=>st*v+ct*orbitNormal[i]);
 return [[ch,0,0,-sh],...radial.map((v,i)=>[sh*v,screenRight[i],screenUp[i],-ch*v])];
}
