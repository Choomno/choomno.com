import {cellTurn} from './rhombic.js';
const copies=[...document.querySelectorAll('main > section .reading-copy')];
const multiply=(m,v)=>m.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
function solve(a){
 for(let i=0;i<8;i++){
  let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
  [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];if(Math.abs(d)<1e-12)return null;
  for(let k=i;k<9;k++)a[i][k]/=d;
  for(let j=0;j<8;j++)if(j!==i){const f=a[j][i];for(let k=i;k<9;k++)a[j][k]-=f*a[i][k];}
 }return a.map(row=>row[8]);
}
export function projectText(phase){
 const camera=cellTurn(-phase);
 copies.forEach((copy,i)=>{
  const separation=Math.abs(phase-i*Math.PI/4);
  if(separation>=Math.PI/4){copy.style.visibility='hidden';return;}
  copy.style.opacity=String(Math.max(0,1-Math.pow(separation/(Math.PI/4),4)));
  const width=copy.offsetWidth,height=copy.offsetHeight,station=cellTurn(-i*Math.PI/4);
  const z=.8,half=z*.82*Math.min(width,innerWidth*.88)/innerHeight,vertical=half*height/width;
  const corners=[[-half,vertical],[half,vertical],[half,-vertical],[-half,-vertical]];
  const screen=corners.map(([x,y])=>{
   const world=multiply(station,[Math.sqrt(1+x*x+y*y+z*z),x,y,z]);
   const local=[0,1,2,3].map(col=>-camera[0][col]*world[0]+camera.slice(1).reduce((s,row,r)=>s+row[col]*world[r+1],0));
   if(local[3]<=.02)return null;
   return [innerWidth/2+local[1]/local[3]*innerHeight/(2*.82),innerHeight/2-local[2]/local[3]*innerHeight/(2*.82)];
  });
  if(screen.some(p=>!p)){copy.style.visibility='hidden';return;}
  const source=[[0,0],[width,0],[width,height],[0,height]],equations=[];
  source.forEach(([x,y],j)=>{const [u,v]=screen[j];equations.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
  const h=solve(equations);if(!h)return;
  copy.style.visibility='visible';copy.style.transform=`matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
 });
}
