// Reading positions become camera keyframes, with quiet intervals around them.
export function phaseAtScroll(y,landmarks,hold){
 const knots=[{y:0,phase:0}];
 for(const mark of landmarks){
  knots.push({y:Math.max(knots.at(-1).y,mark.y-hold),phase:mark.phase});
  knots.push({y:Math.max(knots.at(-1).y,mark.y+hold),phase:mark.phase});
 }
 if(y<=0)return 0;
 for(let i=1;i<knots.length;i++){
  const a=knots[i-1],b=knots[i];if(y>b.y)continue;
  const t=b.y>a.y?Math.max(0,Math.min(1,(y-a.y)/(b.y-a.y))):1;
  const eased=t*t*(3-2*t);
  return a.phase+(b.phase-a.phase)*eased;
 }
 return knots.at(-1).phase;
}
