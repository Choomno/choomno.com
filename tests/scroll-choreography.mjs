import assert from 'node:assert/strict';
import {phaseAtScroll} from '../scroll-choreography.js';
import {cellTurn,dot,advance,identity} from '../rhombic.js';
import {readFile} from 'node:fs/promises';
const marks=[{y:600,phase:Math.PI/4},{y:1300,phase:Math.PI/2},{y:2000,phase:3*Math.PI/4}];
for(const m of marks)for(const offset of [-100,0,100])assert.equal(phaseAtScroll(m.y+offset,marks,100),m.phase);
let previous=0;for(let y=0;y<=2400;y++){const p=phaseAtScroll(y,marks,100);assert.ok(p>=previous);previous=p;}
const data=JSON.parse(await readFile(new URL('../rhombic-data.json',import.meta.url),'utf8'));
const f=cellTurn(phaseAtScroll(600,marks,100)),U=[1,1,0,0];
const sky=(frame,u)=>{const q=frame[0].map((_,j)=>dot(frame.map(r=>r[j]),u));return q.slice(1).map(x=>x/-q[0]);};
for(const [i,v] of sky(f,U).entries())assert.ok(Math.abs(v-[0,0,-1][i])<1e-12);
const folded=advance(identity(),0,f,data,U);
for(const [i,v] of sky(folded.frame,folded.ideal).entries())assert.ok(Math.abs(v-[0,0,-1][i])<1e-10);
console.log('Reading holds, monotone scroll transitions, and exactly rearward ideal endpoint verified before and after face identifications.');
