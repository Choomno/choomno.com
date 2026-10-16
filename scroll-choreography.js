// Monotone cubic interpolation passes through reading poses without flat holds.
export function phaseAtScroll(y,landmarks){
 const knots=[{y:0,phase:0},...landmarks];
 if(y<=0)return 0;
 const h=knots.slice(1).map((p,i)=>p.y-knots[i].y);
 const slope=h.map((width,i)=>(knots[i+1].phase-knots[i].phase)/width);
 const tangent=knots.map((_,i)=>{
  if(i===0)return slope[0];
  if(i===knots.length-1)return slope.at(-1);
  if(slope[i-1]*slope[i]<=0)return 0;
  const w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];
  return (w1+w2)/(w1/slope[i-1]+w2/slope[i]);
 });
 for(let i=0;i<h.length;i++){
  if(y>knots[i+1].y)continue;
  const t=(y-knots[i].y)/h[i],t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*knots[i].phase+(t3-2*t2+t)*h[i]*tangent[i]
    +(-2*t3+3*t2)*knots[i+1].phase+(t3-t2)*h[i]*tangent[i+1];
 }
 return knots.at(-1).phase;
}
